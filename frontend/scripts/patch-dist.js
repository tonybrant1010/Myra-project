const fs = require("fs");
const path = require("path");

// 0. Statikus ikonok másolása a dist-be (expo export törli ezeket)
const ICONS_SRC = path.join(__dirname, "../../../myra_project");
const ICONS_DST = path.join(__dirname, "../dist");
const iconFiles = [
  "apple-touch-icon.png",
  "favicon.ico",
  "favicon-32x32.png",
  "favicon-16x16.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "site.webmanifest",
];
for (const f of iconFiles) {
  const src = path.join(ICONS_SRC, f);
  const dst = path.join(ICONS_DST, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`✓ ${f} másolva → dist/`);
  } else {
    console.warn(`⚠ Nem található: ${src}`);
  }
}

// 1. vercel.json patch
const vercelJson = {
  rewrites: [
    { source: "/api/:path*", destination: "http://91.214.112.96:8001/:path*" },
    { source: "/((?!api/).*)", destination: "/index.html" },
  ],
};
fs.writeFileSync(
  path.join(__dirname, "../dist/vercel.json"),
  JSON.stringify(vercelJson, null, 2)
);
console.log("✓ dist/vercel.json patched");

// 2. index.html patch — iOS / PWA meta tagek
const indexPath = path.join(__dirname, "../dist/index.html");
let html = fs.readFileSync(indexPath, "utf8");

// Viewport fix: maximum-scale=1 megakadályozza az iOS auto-zoomot beviteli mezőknél
html = html.replace(
  /(<meta\s+name="viewport"\s+content=")[^"]*"/,
  '$1width=device-width, initial-scale=1, maximum-scale=1"'
);

const iosTags = [
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Myra">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">',
].join("");

// Berakjuk a meglévő favicon link elé
if (!html.includes("apple-mobile-web-app-capable")) {
  html = html.replace(
    '<link rel="icon" href="/favicon.ico" />',
    iosTags + '<link rel="icon" href="/favicon.ico" />'
  );
  fs.writeFileSync(indexPath, html, "utf8");
  console.log("✓ dist/index.html patched (iOS/PWA meta tagek hozzáadva)");
} else {
  console.log("✓ dist/index.html már patched");
}
