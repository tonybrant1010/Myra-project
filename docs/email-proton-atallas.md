# E-mail átállás Gmailről Proton Mailre

**Dátum:** 2026-10-14
**Cél:** minden rendszerlevél a Proton Mailon menjen ki, a saját domainről (`myra-project.hu`),
a Gmail mindenhonnan kikerüljön.

---

## 1. A címek és a szerepük

| cím | szerep | változó |
|---|---|---|
| `noreply@myra-project.hu` | a rendszerlevelek feladója | `MYRA_MAIL_FROM` |
| `admin@myra-project.hu` | a belső riasztások helye | `MYRA_ALERT_EMAIL` |
| `info@myra-project.hu` | nyilvános kapcsolattartó: a levelek alján, a `Reply-To`-ban, a jogi szövegekben | `MYRA_CONTACT_EMAIL` |

| levél | címzett | küldő | válasz megy |
|---|---|---|---|
| belépési és admin biztonsági kód | a felhasználó | `noreply@` | `info@` |
| jelszó-visszaállítási kód | a felhasználó | `noreply@` | `info@` |
| krízisjelzés | `admin@` | `noreply@` | — |
| chat-visszajelzés | `admin@` | `noreply@` | a visszajelzést küldő felhasználó |
| belépés-riasztás (admin) | `admin@` | `noreply@` | — |
| üzemeltetési riasztás (`myra-watch`, deploy) | `admin@` | `noreply@` | — |

> A Proton SMTP token **egyetlen címhez** szól, ezért a `MYRA_SMTP_USER`-nek meg kell
> egyeznie a `MYRA_MAIL_FROM`-mal. Ha `noreply@`-ról küldünk, ahhoz külön token kell a
> Protonban (*Settings → All settings → IMAP/SMTP → SMTP tokens*).

---

## 2. A `.env` kulcsai

```
MYRA_SMTP_HOST=smtp.protonmail.ch
MYRA_SMTP_PORT=587
MYRA_SMTP_SECURITY=starttls
MYRA_SMTP_TLS_VERIFY=true
MYRA_SMTP_USER=noreply@myra-project.hu
MYRA_SMTP_PASSWORD=<a noreply@ címhez generált SMTP token>
MYRA_MAIL_FROM=noreply@myra-project.hu
MYRA_MAIL_FROM_NAME=Myra-project
MYRA_CONTACT_EMAIL=info@myra-project.hu
MYRA_ALERT_EMAIL=admin@myra-project.hu
```

A `MYRA_SMTP_PASSWORD` **nem** a Proton-fiók jelszava, hanem egy külön generált token.

---

## 3. DNS rekordok (a domain szolgáltatójánál)

| típus | név | érték |
|---|---|---|
| MX | `@` (10) | `mail.protonmail.ch` |
| MX | `@` (20) | `mailsec.protonmail.ch` |
| TXT | `@` | `v=spf1 include:_spf.protonmail.ch ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine` |
| CNAME | a Proton által megadott 3 DKIM név | `…domains.proton.ch` |
| TXT | `@` | `protonmail-verification=…` (a domain hitelesítéséhez) |

Az e-mail független a szerver IP-címétől: az MX a Protonra mutat, ezért egy IP-váltás
nem érinti a levelezést.

---

## 4. Tartalék út: Proton Mail Bridge

Ha nincs SMTP token, a Bridge konténer használható. A `bridge` profil mögött van,
ezért alapból nem indul:

```bash
docker compose --profile bridge run --rm proton-bridge init   # egyszeri bejelentkezés
docker compose --profile bridge up -d
```

A Bridge a konténerben kizárólag `127.0.0.1`-re köt, ezért egy `socat` forwardolja:
a compose hálózatáról a `proton-bridge:25`, a hosztról a `127.0.0.1:1025` érhető el.
Ez az út 150–400 MB RAM-ot kér, ezért csak tartalék.

| ki | hol keresi az SMTP-t |
|---|---|
| backend konténer | `MYRA_SMTP_HOST` / `MYRA_SMTP_PORT` |
| `ops/myra-watch.py`, `ops/myra-deploy.py` (hoszt) | ugyanaz; Bridge-nél `MYRA_SMTP_HOST_LOCAL=127.0.0.1` + `MYRA_SMTP_PORT_LOCAL=1025` |

A `MYRA_SMTP_TLS_VERIFY` alapértéke `true`. **Kizárólag** a Bridge helyi,
önnaláírt tanúsítványánál szabad `false`-ra venni.

---

## 5. Ellenőrzés

Sikeres küldésnél a levél fejlécében:

- `From: Myra-project <noreply@myra-project.hu>`
- `Reply-To: info@myra-project.hu` (a felhasználónak menő leveleknél)
- `spf=pass`, `dkim=pass`, `dmarc=pass`

Gyakori hibák:

| tünet | ok |
|---|---|
| `535 5.7.8 authentication failed` | a `MYRA_SMTP_USER` nem egyezik a tokenhez tartozó címmel |
| `Header() takes … positional arguments` | a FastAPI `Header` elárnyékolja az `email.header.Header`-t — a kód `_MailHeader` néven importálja |
| `a Proton SMTP nincs beallitva` a logban | üres `MYRA_SMTP_*` a `.env`-ben |

---

## 6. Admin jogosultság

Az `ADMIN_EMAIL_ALLOWLIST` **csak regisztrációkor** dönt. Egy már regisztrált fiók admin
jogát önmagában nem veszi el — ahhoz az adatbázisban:

```sql
UPDATE users SET is_admin = false, token_version = token_version + 1
WHERE lower(email) LIKE '%@gmail.com';
```
