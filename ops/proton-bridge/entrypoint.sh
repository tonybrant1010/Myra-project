#!/bin/sh
#
# Proton Mail Bridge – headless indítás.
#
#   init : interaktív Bridge-shell (login, info, exit) – egyszeri bejelentkezés
#   run  : noninteractive Bridge + socat forward a 25-es porton
#
# A Bridge a kódjában 127.0.0.1-re köt (ezt nem lehet átállítani), ezért egy
# konténeren belüli socat forwardolja ugyanazt a portot a 25-ösön. Így a
# forrás-IP a Bridge számára 127.0.0.1 lesz, amit el is vár.
set -e

export HOME="${HOME:-/root}"
mkdir -p "$HOME/.gnupg" "$HOME/.password-store"
chmod 700 "$HOME/.gnupg"

# A `pass` tár inicializálása: enélkül a Bridge nem tudja elmenteni a
# bejelentkezést, és GUI/secret-service nélkül nem indul el.
if [ ! -s "$HOME/.password-store/.gpg-id" ]; then
    echo "[bridge] Kulcstár inicializálása (GPG + pass). Ez egyszeri, néhány másodperc..."
    gpg --batch --generate-key /gpg-key-params
    pass init "bridge@myra-project.hu"
    echo "[bridge] Kulcstár kész."
fi

case "${1:-run}" in
    init|cli|--cli)
        # Ide kerül a `login` (Proton-fiók + 2FA), majd az `info`, amely megadja
        # a MYRA_SMTP_USER és MYRA_SMTP_PASSWORD értékét, végül `exit`.
        exec protonmail-bridge --cli
        ;;
    run|--noninteractive|"")
        socat TCP-LISTEN:25,fork,reuseaddr TCP:127.0.0.1:1025 &
        exec protonmail-bridge --noninteractive
        ;;
    *)
        exec "$@"
        ;;
esac
