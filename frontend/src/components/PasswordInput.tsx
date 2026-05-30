import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/src/theme";

type Props = TextInputProps & {
  /** Extra style for the outer box (e.g. { flex: 1 } inside a row). */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Jelszómező beépített láthatóság-kapcsolóval (szem ikon).
 * A téma tokeneit használja, így a teljes app átszínezésekor automatikusan követi a palettát.
 */
export default function PasswordInput({
  containerStyle,
  style,
  placeholderTextColor,
  autoCapitalize = "none",
  autoCorrect = false,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.box, containerStyle]}>
      <TextInput
        {...rest}
        style={[styles.input, style]}
        secureTextEntry={!visible}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        placeholderTextColor={placeholderTextColor ?? theme.textSecondary}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
        style={styles.btn}
        activeOpacity={0.7}
      >
        <Feather name={visible ? "eye-off" : "eye"} size={20} color={(placeholderTextColor as string) ?? theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: theme.textPrimary,
    fontFamily: "Manrope_400Regular",
  },
  btn: { paddingLeft: 12, paddingVertical: 8 },
});
