"""A kimenő e-mail réteg tesztjei.

2026-10-14: a rendszer a Gmailről a Proton Mailre állt át. A levelek a Proton
Mail Bridge helyi SMTP-portján mennek ki, a saját domainről
(info@myra-project.hu). Ezek a tesztek azt őrzik, hogy

- a Gmail-korszak maradványa (GMAIL_USER / GMAIL_APP_PASSWORD) ne kerüljön vissza,
- minden levél a beállított Proton SMTP-n, a helyes feladóval és címzettel menjen ki,
- a felhasználói fejlécekbe ne lehessen sortöréssel extra fejlécet injektálni,
- hiányzó konfiguráció esetén a küldés csendben, kivétel nélkül elmaradjon.

A tesztek nem hálózatoznak: a `smtplib.SMTP` helyett rögzítő helyettesítőt
kapnak, így a levél teljes tartalma vizsgálható.
"""

import os
import sys
from email import message_from_string
from email.header import decode_header, make_header

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server  # noqa: E402


class _FakeSMTP:
    """Minimális SMTP-helyettesítő, amely megjegyzi a küldött leveleket."""

    instances: list["_FakeSMTP"] = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.starttls_context = None
        self.logged_in = None
        self.sent = []
        _FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        return False

    def starttls(self, context=None):
        self.starttls_context = context

    def login(self, user, password):
        self.logged_in = (user, password)

    def sendmail(self, sender, recipients, payload):
        self.sent.append((sender, recipients, payload))


@pytest.fixture
def postafiok(monkeypatch):
    """Beállít egy működő Proton-konfigurációt és elfogja a kimenő leveleket."""
    _FakeSMTP.instances = []
    monkeypatch.setattr(server.smtplib, "SMTP", _FakeSMTP)
    monkeypatch.setattr(server, "MYRA_SMTP_HOST", "proton-bridge")
    monkeypatch.setattr(server, "MYRA_SMTP_PORT", 25)
    monkeypatch.setattr(server, "MYRA_SMTP_USER", "noreply@myra-project.hu")
    monkeypatch.setattr(server, "MYRA_SMTP_PASSWORD", "bridge-jelszo")
    monkeypatch.setattr(server, "MYRA_SMTP_SECURITY", "starttls")
    monkeypatch.setattr(server, "MYRA_SMTP_TLS_VERIFY", False)
    monkeypatch.setattr(server, "MYRA_MAIL_FROM", "noreply@myra-project.hu")
    monkeypatch.setattr(server, "MYRA_MAIL_FROM_NAME", "Myra-project")
    monkeypatch.setattr(server, "MYRA_CONTACT_EMAIL", "info@myra-project.hu")
    monkeypatch.setattr(server, "MYRA_ALERT_EMAIL", "admin@myra-project.hu")
    # A krízisriasztás címe IMPORT időben rögzül a modulban, ezért külön kell.
    monkeypatch.setattr(server, "CRISIS_ALERT_EMAIL", "admin@myra-project.hu")
    return _FakeSMTP


def _sent_message():
    assert _FakeSMTP.instances, "nem indult SMTP-kapcsolat"
    kapcsolat = _FakeSMTP.instances[-1]
    assert kapcsolat.sent, "nem ment ki levél"
    _sender, recipients, payload = kapcsolat.sent[-1]
    return kapcsolat, recipients, message_from_string(payload)


def _body(msg) -> str:
    return msg.get_payload(decode=True).decode("utf-8")


def _fejlec(msg, nev: str) -> str:
    """A fejléc értéke dekódolva.

    A nem-ASCII fejléceket (Subject) az e-mail csomag RFC2047 szerint kódolja
    (pl. ``=?utf-8?b?...?=``), ezért a nyers `msg[nev]` nem hasonlítható össze
    sima szöveggel.
    """
    nyers = msg[nev]
    if nyers is None:
        return ""
    return str(make_header(decode_header(nyers)))


def test_gmail_valtozok_nem_tertek_vissza():
    """A Gmail-korszak változói nem létezhetnek többé a modulban."""
    for nev in ("GMAIL_USER", "GMAIL_APP_PASSWORD", "_send_gmail_reset", "_send_gmail_security_code"):
        assert not hasattr(server, nev), f"A Gmail-maradvány visszakerült: {nev}"


def test_a_level_a_proton_bridge_en_megy_ki(postafiok):
    assert server._send_security_code_email("felhasznalo@example.com", "111111") is True
    kapcsolat, _recipients, _msg = _sent_message()
    assert (kapcsolat.host, kapcsolat.port) == ("proton-bridge", 25)
    assert kapcsolat.starttls_context is not None, "a Bridge STARTTLS-t vár"
    assert kapcsolat.logged_in == ("noreply@myra-project.hu", "bridge-jelszo")


def test_a_bridge_onalairt_tanusitvanya_nem_keri_a_teljes_ellenorzest(postafiok):
    assert server._send_security_code_email("felhasznalo@example.com", "111111") is True
    kapcsolat, _recipients, _msg = _sent_message()
    assert kapcsolat.starttls_context.check_hostname is False
    assert kapcsolat.starttls_context.verify_mode == server.ssl.CERT_NONE


def test_az_ellenorzes_bekapcsolhato_kulso_smtp_hez(postafiok, monkeypatch):
    """Proton Business SMTP vagy más, valódi tanúsítványú végpont esetén."""
    monkeypatch.setattr(server, "MYRA_SMTP_TLS_VERIFY", True)
    _FakeSMTP.instances = []
    assert server._send_password_reset_email("felhasznalo@example.com", "123456") is True
    kapcsolat, _recipients, _msg = _sent_message()
    assert kapcsolat.starttls_context.check_hostname is True
    assert kapcsolat.starttls_context.verify_mode == server.ssl.CERT_REQUIRED


def test_a_felado_fejlec_az_email_headerrel_keszul():
    """A modulban a `Header` név a FastAPI-é, ezért a levél-FEJLÉCET a
    `_MailHeader` alias adja. Enélkül a `Header(...)` hívás a FastAPI
    függvényére futna, ami csak egy pozicionális argumentumot fogad —
    2026-10-14-én ez éles hibát okozott a visszajelzés-küldésnél."""
    import email.header

    assert server._MailHeader is email.header.Header
    # A modul valódi névkörnyezetében a `Header` a FastAPI-é:
    from fastapi import Header as FastapiHeader

    assert server.Header is FastapiHeader
    assert server._mail_from_header() == f"Myra-project <{server.MYRA_MAIL_FROM}>"


def test_a_felado_a_sajat_domain(postafiok):
    server._send_password_reset_email("felhasznalo@example.com", "123456")
    kapcsolat, recipients, msg = _sent_message()
    assert msg["From"] == "Myra-project <noreply@myra-project.hu>"
    assert msg["To"] == "felhasznalo@example.com"
    assert recipients == ["felhasznalo@example.com"]
    assert kapcsolat.sent[-1][0] == "noreply@myra-project.hu", "a boríték-feladó is a saját domain legyen"


def test_a_felhasznaloi_level_valaszcime_a_kapcsolattarto(postafiok):
    """A noreply@-ra nem lehet válaszolni, ezért a Reply-To a nyilvános cím."""
    server._send_security_code_email("felhasznalo@example.com", "111111")
    _kapcsolat, _recipients, msg = _sent_message()
    assert msg["Reply-To"] == "info@myra-project.hu"


def test_a_visszajelzes_valaszcime_a_felhasznalo(postafiok):
    """A riasztás a rendszertől jön, de a válasz a visszajelzőhöz menjen."""
    server._send_feedback_email("Teszt Elek", "felhasznalo@example.com", 1, "chat", "szia")
    _kapcsolat, _recipients, msg = _sent_message()
    assert msg["Reply-To"] == "felhasznalo@example.com"
    assert msg["From"] == "Myra-project <noreply@myra-project.hu>"


def test_a_jelszo_visszaallito_level_tartalma(postafiok):
    server._send_password_reset_email("felhasznalo@example.com", "654321")
    _kapcsolat, _recipients, msg = _sent_message()
    assert _fejlec(msg, "Subject") == "Jelszó visszaállítás - Myra-project"
    torzs = _body(msg)
    assert "654321" in torzs
    assert str(server.RESET_TOKEN_TTL_MINUTES) in torzs
    assert "info@myra-project.hu" in torzs, "a levél alján ott legyen a valódi kapcsolattartó cím"


def test_a_belepesi_kod_level_tartalma(postafiok):
    server._send_security_code_email("felhasznalo@example.com", "112233", "login")
    _kapcsolat, _recipients, msg = _sent_message()
    assert _fejlec(msg, "Subject") == "Belépési kód - Myra-project"
    assert "112233" in _body(msg)


def test_az_admin_muvelet_kod_annak_jeloli_magat(postafiok):
    server._send_security_code_email("admin@myra-project.hu", "998877", "admin_action")
    _kapcsolat, _recipients, msg = _sent_message()
    assert _fejlec(msg, "Subject") == "Admin biztonsági megerősítés"
    assert "998877" in _body(msg)


def test_a_visszajelzes_a_riasztasi_cimre_megy(postafiok):
    server._send_feedback_email("Teszt Elek", "felhasznalo@example.com", 42, "chat", "Valami nem működik.")
    _kapcsolat, recipients, msg = _sent_message()
    assert recipients == ["admin@myra-project.hu"]
    assert "Myra visszajelzes" in _fejlec(msg, "Subject")
    torzs = _body(msg)
    assert "Valami nem működik." in torzs
    assert "felhasznalo@example.com" in torzs


def test_a_belepesi_riasztas_a_riasztasi_cimre_megy(postafiok):
    server._send_login_alert_email("Teszt Elek", "felhasznalo@example.com", False, "1.2.3.4", "Teszt böngésző", "új eszköz")
    _kapcsolat, recipients, msg = _sent_message()
    assert recipients == ["admin@myra-project.hu"]
    assert "Biztonsági riasztás" in _fejlec(msg, "Subject")
    torzs = _body(msg)
    assert "1.2.3.4" in torzs
    assert "új eszköz" in torzs


def test_a_krizisjelzes_a_riasztasi_cimre_megy(postafiok):
    server._send_crisis_alert_email("Teszt Elek", "felhasznalo@example.com", 7, "nem akarok tovább élni", "2026.10.14 10:00")
    _kapcsolat, recipients, msg = _sent_message()
    assert recipients == ["admin@myra-project.hu"]
    assert "KRIZISJELZES" in _fejlec(msg, "Subject")
    assert "nem akarok tovább élni" in _body(msg)


def test_a_riasztasi_cim_felulirhato(postafiok, monkeypatch):
    monkeypatch.setattr(server, "MYRA_ALERT_EMAIL", "ugyelet@myra-project.hu")
    server._send_feedback_email("Teszt Elek", "felhasznalo@example.com", 1, "chat", "szöveg")
    _kapcsolat, recipients, _msg = _sent_message()
    assert recipients == ["ugyelet@myra-project.hu"]


def test_fejlec_injekcio_nem_megy_at(postafiok):
    """A felhasználói adatból származó fejlécértékbe nem kerülhet sortörés."""
    server._send_login_alert_email(
        "Teszt Elek", "felhasznalo@example.com\r\nBcc: tamado@evil.example", False,
        "1.2.3.4", "Teszt", "új eszköz",
    )
    _kapcsolat, _recipients, msg = _sent_message()
    assert msg["Bcc"] is None, "fejléc-injekció: Bcc került a levélbe"
    assert "\n" not in _fejlec(msg, "Subject")
    assert set(msg.keys()) <= {
        "Content-Type", "MIME-Version", "Content-Transfer-Encoding",
        "Subject", "From", "To", "Date", "Message-ID",
    }


def test_minden_level_kap_datumot_es_message_id_t(postafiok):
    server._send_security_code_email("felhasznalo@example.com", "111111")
    _kapcsolat, _recipients, msg = _sent_message()
    assert msg["Date"]
    assert msg["Message-ID"].startswith("<") and msg["Message-ID"].endswith(">")


def test_hianyzo_konfiguracio_eseten_csendben_elmarad(postafiok, monkeypatch):
    monkeypatch.setattr(server, "MYRA_SMTP_PASSWORD", "")
    assert server._mail_configured() is False
    assert server._send_password_reset_email("felhasznalo@example.com", "123456") is False
    assert _FakeSMTP.instances == [], "konfiguráció nélkül nem szabad SMTP-kapcsolatot nyitni"


def test_ures_cimzettlista_nem_okoz_kivetelt(postafiok):
    assert server._send_mail(server.MIMEText("x", "plain", "utf-8"), []) is False
    assert _FakeSMTP.instances == []


def test_halozati_hiba_nem_dob_kivetelt(postafiok, monkeypatch):
    def _robban(*_a, **_k):
        raise OSError("nincs hálózat")

    monkeypatch.setattr(server.smtplib, "SMTP", _robban)
    assert server._send_password_reset_email("felhasznalo@example.com", "123456") is False


def test_indulaskor_figyelmeztet_a_cimeltresre(monkeypatch, caplog):
    """A Proton SMTP token egy címhez szól: ha a user és a feladó eltér,
    induláskor szóljunk, ne a semmitmondó 535-nél derüljön ki."""
    import logging

    monkeypatch.setattr(server, "MYRA_SMTP_USER", "info@myra-project.hu")
    monkeypatch.setattr(server, "MYRA_MAIL_FROM", "noreply@myra-project.hu")
    with caplog.at_level(logging.WARNING, logger="myra"):
        server._warn_mail_address_mismatch()
    assert any("ELTER" in r.getMessage() for r in caplog.records), caplog.text


def test_egyezo_cimeknel_nincs_figyelmeztetes(monkeypatch, caplog):
    import logging

    monkeypatch.setattr(server, "MYRA_SMTP_USER", "noreply@myra-project.hu")
    monkeypatch.setattr(server, "MYRA_MAIL_FROM", "noreply@myra-project.hu")
    caplog.clear()
    with caplog.at_level(logging.WARNING, logger="myra"):
        server._warn_mail_address_mismatch()
    assert not [r for r in caplog.records if "ELTER" in r.getMessage()], caplog.text


def test_az_535_hiba_megnevezi_a_cimeltrest(postafiok, monkeypatch, caplog):
    """535 esetén a napló mondja meg, hogy a token/cím a baj."""
    import logging

    monkeypatch.setattr(server, "MYRA_SMTP_USER", "info@myra-project.hu")
    monkeypatch.setattr(server, "MYRA_MAIL_FROM", "noreply@myra-project.hu")

    def _auth_hiba(*_a, **_k):
        raise server.smtplib.SMTPAuthenticationError(535, b"5.7.8 authentication failed")

    monkeypatch.setattr(server.smtplib, "SMTP", _auth_hiba)
    with caplog.at_level(logging.ERROR, logger="myra"):
        assert server._send_password_reset_email("felhasznalo@example.com", "123456") is False
    uzenetek = " ".join(r.getMessage() for r in caplog.records)
    assert "HITELESITESI hiba" in uzenetek, caplog.text
    assert "nem egyezik" in uzenetek, caplog.text
