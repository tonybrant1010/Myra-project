import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GoogleGenAI, Modality, type Session } from "@google/genai";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { authedFetch, useAuth } from "@/src/auth/AuthContext";
import { useAuthGuard } from "@/src/auth/useAuthGuard";
import ContentBackground from "@/src/components/ContentBackground";
import TopBar from "@/src/components/TopBar";
import { T } from "@/src/components/Typography";
import { shadow, theme } from "@/src/theme";

const MYRA_AVATAR = require("@/assets/images/myra-avatar.png");
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const OUTPUT_GAIN = 2.2;

type LivePhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

type LiveTokenResponse = {
  token: string;
  model: string;
  websocket_url: string;
};

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function resampleTo16k(input: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === INPUT_RATE) return input;
  const ratio = sourceRate / INPUT_RATE;
  const output = new Float32Array(Math.max(1, Math.round(input.length / ratio)));
  for (let i = 0; i < output.length; i += 1) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, input.length - 1);
    const mix = sourceIndex - left;
    output[i] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function microphoneErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/permission|denied|notallowed/i.test(message)) {
    return "A böngésző nem engedélyezte a mikrofon használatát.";
  }
  return message || "A mikrofon nem indítható el.";
}

export default function MyraLiveScreen() {
  useAuthGuard();
  const { token } = useAuth();
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [status, setStatus] = useState("Érintsd meg a mikrofont a beszélgetéshez.");
  const [userTranscript, setUserTranscript] = useState("");
  const [myraTranscript, setMyraTranscript] = useState("");
  const pulse = useRef(new Animated.Value(0)).current;
  const sessionRef = useRef<Session | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const playingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mountedRef = useRef(true);
  const closingRef = useRef(false);
  const startingRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  const isActive = phase !== "idle" && phase !== "error";
  const isSpeaking = phase === "speaking";

  const stopPlayback = useCallback(() => {
    playingSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {}
    });
    playingSourcesRef.current.clear();
    nextPlaybackTimeRef.current = 0;
  }, []);

  const releaseWakeLock = useCallback(() => {
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (wakeLock) {
      void wakeLock.release?.().catch?.(() => {});
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (Platform.OS !== "web" || wakeLockRef.current) return;
    const wakeLockApi = (globalThis.navigator as any)?.wakeLock;
    if (!wakeLockApi?.request) return;
    try {
      const wakeLock = await wakeLockApi.request("screen");
      wakeLockRef.current = wakeLock;
      wakeLock.addEventListener?.("release", () => {
        if (wakeLockRef.current === wakeLock) wakeLockRef.current = null;
      });
    } catch {}
  }, []);

  const closeSession = useCallback(() => {
    closingRef.current = true;
    startingRef.current = false;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    sessionRef.current?.close();
    void inputContextRef.current?.close();
    void outputContextRef.current?.close();
    stopPlayback();
    releaseWakeLock();

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    sessionRef.current = null;
    inputContextRef.current = null;
    outputContextRef.current = null;
    outputGainRef.current = null;
    if (mountedRef.current) {
      setPhase("idle");
      setStatus("Érintsd meg a mikrofont a beszélgetéshez.");
    }
  }, [releaseWakeLock, stopPlayback]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      closeSession();
    };
  }, [closeSession]);

  useEffect(() => {
    if (!isActive) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: isSpeaking ? 620 : 1100,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: isSpeaking ? 620 : 1100,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isActive, isSpeaking, pulse]);

  useEffect(() => {
    if (!isActive) {
      releaseWakeLock();
      return;
    }
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    void requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    const handlePageHide = () => {
      releaseWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    globalThis.addEventListener?.("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      globalThis.removeEventListener?.("pagehide", handlePageHide);
    };
  }, [isActive, releaseWakeLock, requestWakeLock]);

  const playAudioChunk = useCallback(async (base64Audio: string) => {
    const AudioContextCtor = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!outputContextRef.current) outputContextRef.current = new AudioContextCtor({ sampleRate: OUTPUT_RATE });
    const context: AudioContext = outputContextRef.current!;
    if (context.state === "suspended") await context.resume();
    if (!outputGainRef.current) {
      const gain = context.createGain();
      gain.gain.value = OUTPUT_GAIN;
      gain.connect(context.destination);
      outputGainRef.current = gain;
    }

    const bytes = base64ToBytes(base64Audio);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const frameCount = Math.floor(bytes.byteLength / 2);
    const buffer = context.createBuffer(1, frameCount, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(outputGainRef.current);
    const startAt = Math.max(context.currentTime + 0.025, nextPlaybackTimeRef.current);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
    playingSourcesRef.current.add(source);
    source.onended = () => playingSourcesRef.current.delete(source);
    source.start(startAt);
  }, []);

  const handleServerMessage = useCallback((message: any) => {
    if (message.setupComplete) {
      setPhase("listening");
      setStatus("Hallgatlak.");
      return;
    }

    const content = message.serverContent;
    if (!content) return;
    if (content.interrupted) {
      stopPlayback();
      setPhase("listening");
      setStatus("Hallgatlak.");
    }
    if (content.inputTranscription?.text) {
      setUserTranscript((current) => `${current}${content.inputTranscription.text}`);
      setPhase("thinking");
      setStatus("Myra figyel.");
    }
    if (content.outputTranscription?.text) {
      setMyraTranscript((current) => `${current}${content.outputTranscription.text}`);
    }

    const parts = content.modelTurn?.parts || [];
    for (const part of parts) {
      const audio = part.inlineData || part.inline_data;
      const mimeType = String(audio?.mimeType || audio?.mime_type || "");
      if (audio?.data && mimeType.startsWith("audio/")) {
        setPhase("speaking");
        setStatus("Myra beszél.");
        void playAudioChunk(audio.data);
      }
    }
    if (content.turnComplete) {
      const context = outputContextRef.current;
      const remainingMs = context
        ? Math.max(0, (nextPlaybackTimeRef.current - context.currentTime) * 1000)
        : 0;
      globalThis.setTimeout(() => {
        if (!mountedRef.current || !sessionRef.current) return;
        setPhase("listening");
        setStatus("Hallgatlak.");
        setUserTranscript("");
      }, remainingMs + 80);
    }
  }, [playAudioChunk, stopPlayback]);

  const startMicrophone = useCallback(async (session: Session) => {
    const mediaDevices = globalThis.navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia) throw new Error("A böngésző nem támogatja a mikrofon használatát.");

    const stream = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    const AudioContextCtor = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    const context: AudioContext = new AudioContextCtor();
    if (context.state === "suspended") await context.resume();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = floatTo16BitPCM(resampleTo16k(input, context.sampleRate));
      session.sendRealtimeInput({
        audio: {
          data: bytesToBase64(new Uint8Array(pcm.buffer)),
          mimeType: `audio/pcm;rate=${INPUT_RATE}`,
        },
      });
    };

    source.connect(processor);
    processor.connect(context.destination);
    streamRef.current = stream;
    inputContextRef.current = context;
    sourceRef.current = source;
    processorRef.current = processor;
  }, []);

  const startSessionSdk = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    if (Platform.OS !== "web") {
      startingRef.current = false;
      setPhase("error");
      setStatus("A Myra Live béta jelenleg a webalkalmazásban használható.");
      return;
    }

    setPhase("connecting");
    setStatus("Kapcsolódás Myrához...");
    setUserTranscript("");
    setMyraTranscript("");
    closingRef.current = false;

    let connectTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    try {
      const response = await authedFetch(token, "/api/live/token", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || "Nem sikerült előkészíteni a Live kapcsolatot.");
      }

      const live = data as LiveTokenResponse;
      const ai = new GoogleGenAI({
        apiKey: live.token,
        httpOptions: { apiVersion: "v1alpha" },
      });
      let connectedSession: Session | null = null;
      let setupReady = false;
      let microphoneStarted = false;
      const startWhenReady = async () => {
        if (!setupReady || !connectedSession || microphoneStarted) return;
        microphoneStarted = true;
        setStatus("Mikrofon engedélyezése...");
        try {
          await startMicrophone(connectedSession);
          if (mountedRef.current) {
            setPhase("listening");
            setStatus("Hallgatlak.");
          }
        } catch (error) {
          closingRef.current = true;
          connectedSession.close();
          sessionRef.current = null;
          setPhase("error");
          setStatus(microphoneErrorMessage(error));
        }
      };
      const connectTimeout = new Promise<never>((_, reject) => {
        connectTimer = globalThis.setTimeout(
          () => reject(new Error("A Google Live kapcsolat nem jött létre 15 másodpercen belül.")),
          15000
        );
      });
      const connectPromise = ai.live.connect({
        model: live.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          temperature: 0.7,
        },
        callbacks: {
          onopen: () => {
            if (mountedRef.current) setStatus("Mikrofon engedélyezése...");
          },
          onmessage: (message) => {
            if (message.setupComplete) {
              setupReady = true;
              void startWhenReady();
            }
            handleServerMessage(message);
          },
          onerror: () => {
            if (!mountedRef.current) return;
            setPhase("error");
            setStatus("A Google Live kapcsolat hibát jelzett. Próbáld újra.");
          },
          onclose: (event) => {
            if (!mountedRef.current || closingRef.current) return;
            sessionRef.current = null;
            setPhase("idle");
            setStatus(
              event.reason
                ? `A Live kapcsolat lezárult: ${event.reason}`
                : `A Live kapcsolat lezárult (${event.code}).`
            );
          },
        },
      });

      const session = await Promise.race([connectPromise, connectTimeout]);
      if (connectTimer) globalThis.clearTimeout(connectTimer);
      connectedSession = session;
      sessionRef.current = session;
      void startWhenReady();
    } catch (error) {
      if (connectTimer) globalThis.clearTimeout(connectTimer);
      closeSession();
      setPhase("error");
      setStatus(error instanceof Error ? error.message : "Nem sikerült elindítani a Myra Live-ot.");
    } finally {
      startingRef.current = false;
    }
  }, [closeSession, handleServerMessage, startMicrophone, token]);

  const toggleSession = useCallback(() => {
    if (isActive) closeSession();
    else void startSessionSdk();
  }, [closeSession, isActive, startSessionSdk]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, isSpeaking ? 1.16 : 1.09],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.48, 0.08],
  });

  return (
    <SafeAreaView style={styles.safe} testID="myra-live-screen">
      <TopBar title="Myra Live" showBack rightLabel="BÉTA" />
      <ContentBackground>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.stage}>
            <View style={styles.avatarStage}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  styles.noPointer,
                  { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                ]}
              />
              <LinearGradient
                colors={["rgba(87,199,255,0.34)", "rgba(139,143,232,0.18)"]}
                style={[styles.avatarFrame, shadow.glow]}
              >
                <Image source={MYRA_AVATAR} style={styles.avatar} resizeMode="cover" />
              </LinearGradient>
            </View>

            <T variant="h2" color={theme.textOnDark} align="center" style={styles.status}>
              {status}
            </T>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isActive ? "Live beszélgetés befejezése" : "Live beszélgetés indítása"}
              style={[styles.micButton, isActive && styles.micButtonActive]}
              activeOpacity={0.78}
              onPress={toggleSession}
              testID="myra-live-microphone"
            >
              <Ionicons name={isActive ? "stop" : "mic"} size={31} color={theme.white} />
            </TouchableOpacity>

            <T variant="small" color="rgba(247,251,255,0.62)" align="center">
              {isActive ? "A leállításhoz érintsd meg újra." : "A mikrofon engedélyezése után rögtön beszélhetsz."}
            </T>

            <View style={styles.memoryNotice}>
              <Ionicons name="information-circle-outline" size={16} color="rgba(247,251,255,0.64)" />
              <T variant="small" color="rgba(247,251,255,0.66)" align="center" style={styles.memoryNoticeText}>
                A Live csak az aktuális kapcsolat ideje alatt követi a beszélgetést. Lezárás után nem készül leirat, és a következő Live nem emlékszik erre.
              </T>
            </View>
          </View>


        </ScrollView>
        <View style={styles.disclaimerBar}>
          <T variant="small" color="rgba(247,251,255,0.42)" align="center" style={styles.disclaimerText}>
            A Myra Live egy mesterséges intelligenciával támogatott önismereti asszisztens. Nem ad orvosi tanácsot és nem helyettesíti a szakembert.
          </T>
        </View>
      </ContentBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  noPointer: { pointerEvents: "none" },
  safe: { flex: 1, backgroundColor: theme.primaryDark },
  scroll: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 42 },
  stage: { alignItems: "center", justifyContent: "center", minHeight: 430 },
  avatarStage: { width: 236, height: 236, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  pulseRing: {
    position: "absolute",
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 3,
    borderColor: theme.accent,
    backgroundColor: "rgba(87,199,255,0.10)",
  },
  avatarFrame: {
    width: 196,
    height: 196,
    borderRadius: 98,
    padding: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 92 },
  status: { minHeight: 29, marginBottom: 22, fontSize: 19, lineHeight: 26 },
  micButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentDeep,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    marginBottom: 12,
    ...shadow.glow,
  },
  micButtonActive: { backgroundColor: theme.danger },
  memoryNotice: {
    maxWidth: 380,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(6,19,32,0.42)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  memoryNoticeText: {
    flex: 1,
    lineHeight: 18,
  },
  transcriptPanel: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    backgroundColor: "rgba(6,19,32,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    padding: 18,
  },
  transcriptHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 },
  transcriptIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(87,199,255,0.14)",
  },
  transcriptSection: { minHeight: 65 },
  transcriptText: { marginTop: 5, lineHeight: 22 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 14 },
  disclaimerBar: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(6,19,32,0.62)",
    borderTopWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  disclaimerText: {
    fontSize: 10,
    lineHeight: 14,
  },
});
