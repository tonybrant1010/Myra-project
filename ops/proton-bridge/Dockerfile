# syntax=docker/dockerfile:1
#
# Proton Mail Bridge – headless, a Proton HIVATALOS, pinnelt .deb csomagjából.
#
# Miért nem kész image: a Bridge a postaláda hitelesítését tárolja, ezért
# szándékosan nem harmadik féltől származó image-et használunk, hanem a Proton
# által kiadott csomagot telepítjük egy üres Debian alapra. A forrásból való
# fordítás (`make build-nogui`) itt nem opció: Go 1.24 + cgo + több száz MB
# modul-gyorsítótár kell hozzá, a célgép pedig 1 GB RAM-mal swapol.
#
# TARTALÉK ÚT. A szokásos út a Proton közvetlen SMTP-beküldője
# (smtp.protonmail.ch:587) – ezt csak akkor kell megépíteni, ha a Proton-fiókban
# nincs SMTP token. Részletek: docs/email-proton-atallas.md

FROM debian:trixie-slim

# A Proton Bridge aktuális kiadása. Ellenőrizd a GitHub Releases oldalon, és a
# csomag aláírását lásd a dokumentumban (bridge_pubkey.gpg).
ARG BRIDGE_VERSION=3.27.1

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        pass \
        socat \
        libsecret-1-0 \
        libfido2-1 \
    && rm -rf /var/lib/apt/lists/*

# A hivatalos .deb. Az `apt-get install` azért kell a `dpkg -i` helyett, hogy a
# csomag függőségeit is feloldja.
RUN curl -fsSL -o /tmp/bridge.deb \
        "https://github.com/ProtonMail/proton-bridge/releases/download/v${BRIDGE_VERSION}/protonmail-bridge_${BRIDGE_VERSION}-1_amd64.deb" \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/bridge.deb \
    && rm -f /tmp/bridge.deb \
    && rm -rf /var/lib/apt/lists/*

COPY gpg-key-params /gpg-key-params
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# A Bridge a ~/.config, ~/.local/share, ~/.cache, ~/.gnupg és ~/.password-store
# alá dolgozik, ezért a HOME a perzisztens kötet.
ENV HOME=/root
WORKDIR /root
VOLUME ["/root"]

# A 25-ös port a konténeren belüli socat forward; a Bridge maga 127.0.0.1:1025-ön
# figyel, ahhoz kívülről nem lehet csatlakozni.
EXPOSE 25

ENTRYPOINT ["/entrypoint.sh"]
CMD ["run"]
