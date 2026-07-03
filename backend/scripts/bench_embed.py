"""Embedding-modell erőforrás- és sebességmérő.

Futtatás a szerveren (a backend konténerben, az app-ot nem érinti):
    docker exec -it myra-backend python scripts/bench_embed.py
    docker exec -it myra-backend python scripts/bench_embed.py sentence-transformers/paraphrase-multilingual-mpnet-base-v2

Figyelem: új modellnév megadásakor a modell letöltődik a konténerbe (mpnet ~1 GB).
"""
import os
import resource
import sys
import time

DEFAULT_MODEL = os.environ.get(
    "FASTEMBED_MODEL_NAME",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

QUERY = "Miért érzem úgy, hogy mindig ugyanabba a gondolatba ragadok bele és nem tudok szabadulni tőle?"
CHUNK = (
    "A pszichés kényszerhurok olyan ismétlődő gondolati-érzelmi mintázat, amelyben a "
    "lezáratlan érzelmi tartalom újra és újra aktiválódik, és a feldolgozás helyett "
    "fenntartja a feszültséget és a testi készenlétet. " * 6
)


def _meminfo() -> dict:
    info = {}
    try:
        with open("/proc/meminfo", encoding="utf-8") as f:
            for line in f:
                key, _, rest = line.partition(":")
                info[key.strip()] = rest.strip()
    except OSError:
        pass
    return info


def main() -> None:
    model_name = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL
    mem = _meminfo()
    print(f"CPU magok: {os.cpu_count()}")
    print(f"MemTotal: {mem.get('MemTotal', '?')} | MemAvailable: {mem.get('MemAvailable', '?')}")
    print(f"Modell: {model_name}")

    from fastembed import TextEmbedding

    t0 = time.perf_counter()
    model = TextEmbedding(model_name=model_name)
    print(f"Betöltés: {time.perf_counter() - t0:.1f} s")

    list(model.embed([QUERY]))
    latencies = []
    for _ in range(8):
        t = time.perf_counter()
        list(model.embed([QUERY]))
        latencies.append((time.perf_counter() - t) * 1000)
    latencies.sort()
    print(f"Query-embedding medián: {latencies[len(latencies) // 2]:.0f} ms (min {latencies[0]:.0f} / max {latencies[-1]:.0f})")

    t = time.perf_counter()
    list(model.embed([CHUNK] * 10))
    print(f"10 chunk batch: {time.perf_counter() - t:.1f} s (reindex-becslés 250 chunkra: {(time.perf_counter() - t) * 25:.0f} s)")

    rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    print(f"Folyamat RSS-csúcs: {rss_mb:.0f} MB")
    mem_after = _meminfo()
    print(f"MemAvailable utána: {mem_after.get('MemAvailable', '?')}")


if __name__ == "__main__":
    main()
