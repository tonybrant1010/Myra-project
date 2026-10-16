# GPU / áramellátási incidens és a helyi modell tanulságai

**Dátum:** 2026-10-15
**Érintett gép:** `myrallm` (a helyi LLM-szerver), Ubuntu 26.04.1 LTS
**Érintett szolgáltatás:** `llama-server` (llama.cpp router mód, 8080)

---

## 1. A tünet

A platformon egy üzenet elküldése után a szerver **kikapcsolt, majd visszakapcsolt és
újraindult** — nem reset, hanem tényleges áramkimaradás. A GPU külön tápja nem indult
vissza magától. A jelenség terhelésfüggő volt.

## 2. Megfigyelt tények

- Az előző boot kernel naplója **nyom nélkül szakad meg** (`journalctl -k -b -1 | tail -30`):
  nincs `amdgpu` hiba, `panic`, `Oops`, MCE vagy hőmérsékleti figyelmeztetés.
- A journald jelzi: `… corrupted or uncleanly shut down` → tisztátalan leállás.
- Korábban, a bányász-BIOS-sal valódi GPU-hiba is volt:
  `amdgpu … GPU fault detected: 147` és `VM_CONTEXT1_PROTECTION_FAULT` a `llama-server`
  processzben.

## 3. Amit kizártunk

- **A GPU BIOS-a**: a gyári ASUS AS14 Hynix BIOS kiégetve és **bájtazonosan** igazolva
  (`md5 98d191b6eab7f926f9ba56bffd2f184d`). A GPU-hibák eltűntek, a lecsapás megmaradt.
- **A VRAM-túlterhelés**: a `llama-server` a `load-on-startup` miatt az egész VRAM-ot
  lefoglalta (8192 MiB-ból 9 MiB szabad), és a 9B modell emiatt némán CPU-ra esett vissza.
  Ezt a `--models-max 1` és a `load-on-startup` eltávolítása megszüntette.
- **A táp és a föld**: külön táp táplálja a kártyát, zöld-fekete átkötéssel; a szerver
  1000 W-os hot-swap modulja nem ad PCIe kábelt. A két táp földje a PCIe sloton keresztül
  közös — a visszáram az alaplapon záródik, de ez önmagában nem bizonyult a lecsapás okának.

## 4. A valódi tanulság: a KV cache dönt, nem a paraméterszám

A helyi modell kiválasztásánál nem a modell **mérete** és nem is a **magyar** volta a döntő,
hanem hogy **mennyi a KV cache tokenenként**:

```
KV = 2 × rétegek × KV-head-ek × head_dim × bájt
```

| modell | KV-head | KV / token (f16) | 19 000 tokenen |
|---|---|---|---|
| PULI-LlumiX-32K (Llama-2-7B, 2024) | 32 | 512 KiB | **9,5 GiB** ✗ |
| PULI-LlumiX-Llama-3.1 (Llama-3.1-8B) | 8 | 128 KiB | 2,4 GiB ✓ |
| Qwen3.5-9B (GQA) | 8 | 144 KiB | 2,7 GiB ✓ |
| Qwen3.8-27B (hibrit attention) | 4 × 16 réteg | 64 KiB | 1,2 GiB ✓ |

A Myra kérése 15–19 ezer token (120 üzenet előzmény + rendszerprompt). Ehhez a Llama-2-alapú
PULI **9,5 GiB** KV-ot igényelne — a kártyán összesen 8 GB van. Ezért az a modell ezen a
hardveren **nem használható**, bármilyen beállítással.

Kvantált KV cache-sel (`cache-type = q4_0`) ugyan befér, de:
- a Vulkanon a visszafejtés miatt a prompt-feldolgozás **91 token/s-ra** esett (a CPU 134 volt),
- hosszú kontextuson a modell **szótagkavalkádba** torkollott.

## 5. A használható konfiguráció

**Elsődleges: `qwen3.6-35b-a3b`** — MoE, hibrid attention, ezért a KV-je töredéke.
`c = 24576`, a szakértő-rétegek CPU-n (`n-cpu-moe`), az attention a GPU-n. A 24k kontextus
mellett ~5,4 GB VRAM marad szabadon.

**Másodlagos: `puli-llumix-8b`** (Llama-3.1-8B alap) — `c = 20480`, **f16 KV** (nincs
`cache-type` sor), `ubatch-size = 512`. A KV így 2,5 GiB, a súly 4,58 GiB, együtt befér.

## 6. Egyéb üzemeltetési tanulságok

- A `top-` elgépelt kulcs a `models.ini`-ben **hatástalan** — a szerver figyelmen kívül hagyja.
  Érdemes a `/v1/models` válaszából ellenőrizni a tényleges (összevont) beállításokat.
- A helyi modell **saját prompt-formátumot** kap (`[FORDULÓ KONTEXTUSA]`, `[FELHASZNÁLÓ]`
  markerek, a tudásanyag a felhasználói fordulóban) — ez az app találmánya, és egy kis modell
  nehezebben boldogul vele, mint a felhő-modellek.
- A `helyi elotoltes` a rendszerpromptot előre feldolgozza, hogy a kérések gyorsak legyenek.
