#!/usr/bin/env bash
# A Myra kis modelljeinek letoltese ~/gguf ala (16 parhuzamos kapcsolat), majd meretellenorzes.
set -u
cd ~/gguf || exit 1
dl() { aria2c -c -x 16 -s 16 --console-log-level=warn --summary-interval=0 -o "$1" "$2"; }
dl gemma-4-E4B-it-UD-Q4_K_XL.gguf                 https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-UD-Q4_K_XL.gguf
dl EuroLLM-9B-Instruct-2512.Q4_K_M.gguf           https://huggingface.co/mradermacher/EuroLLM-9B-Instruct-2512-GGUF/resolve/main/EuroLLM-9B-Instruct-2512.Q4_K_M.gguf
dl Qwen3.5-9B-UD-Q4_K_XL.gguf                     https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-UD-Q4_K_XL.gguf
dl qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf
dl qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf
dl PULI-LlumiX-Llama-3.1.Q4_K_M.gguf              https://huggingface.co/mradermacher/PULI-LlumiX-Llama-3.1-GGUF/resolve/main/PULI-LlumiX-Llama-3.1.Q4_K_M.gguf
dl Huihui-gemma-4-E4B-it-abliterated.Q4_K_M.gguf   https://huggingface.co/mradermacher/Huihui-gemma-4-E4B-it-abliterated-GGUF/resolve/main/Huihui-gemma-4-E4B-it-abliterated.Q4_K_M.gguf
dl Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf       https://huggingface.co/mradermacher/Huihui-Qwen3.5-9B-abliterated-GGUF/resolve/main/Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf
echo "---- ellenorzes ----"
ok=1
while read -r f size; do
  got=$(stat -c %s "$f" 2>/dev/null || echo 0)
  if [ "$got" = "$size" ]; then echo "OK    $f"; else echo "HIBA  $f ($got / $size)"; ok=0; fi
done <<'LIST'
gemma-4-E4B-it-UD-Q4_K_XL.gguf 5126306944
EuroLLM-9B-Instruct-2512.Q4_K_M.gguf 5582838912
Qwen3.5-9B-UD-Q4_K_XL.gguf 5966095584
qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf 3993201344
qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf 689872288
PULI-LlumiX-Llama-3.1.Q4_K_M.gguf 4920739360
Huihui-gemma-4-E4B-it-abliterated.Q4_K_M.gguf 5335286272
Huihui-Qwen3.5-9B-abliterated.Q4_K_M.gguf 5627045248
LIST
[ "$ok" = 1 ] && echo "MIND RENDBEN" || echo "VAN HIBAS FAJL - futtasd ujra a scriptet"
