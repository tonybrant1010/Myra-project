#!/usr/bin/env node
/**
 * Helyi frontend-telepites a sajat szerverre (a Vercel kivaltasa).
 *
 * A friss dist/ mappat becsomagolja, feltolti a backend hostra, es ott
 * kicsomagolja a /srv/myra-ba, amit a Caddy szolgal ki.
 *
 * Elofeltetelek (egyszeri beallitas):
 *   1) jelszo nelkuli SSH a szerverre (ssh-kulcs),
 *   2) a /srv/myra a myra-admin tulajdona legyen (sudo chown -R myra-admin:myra-admin /srv/myra).
 *
 * Hasznalat: npm run deploy
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.MYRA_DEPLOY_HOST || "myra-admin@192.168.1.103";
const CEL = process.env.MYRA_DEPLOY_DIR || "/srv/myra";
const GYOKER = path.join(__dirname, "..");
const DIST = path.join(GYOKER, "dist");
const TAR = path.join(GYOKER, "myra_dist.tgz");

function fut(parancs, args) {
  console.log(`$ ${parancs} ${args.join(" ")}`);
  execFileSync(parancs, args, { stdio: "inherit" });
}

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("HIBA: nincs kesz dist/ (index.html). Elotte: npm run export && npm run patch-dist");
  process.exit(1);
}

fut("tar", ["-czf", TAR, "-C", DIST, "."]);
fut("scp", [TAR, `${HOST}:/tmp/myra_dist.tgz`]);
fut("ssh", [
  HOST,
  `tar -xzf /tmp/myra_dist.tgz -C ${CEL} && rm -f /tmp/myra_dist.tgz && echo DEPLOY-OK: ${CEL}`,
]);
console.log("Kesz: a frontend a szerveren fut (Caddy szolgalja ki).");
