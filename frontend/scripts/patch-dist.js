const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "../dist");

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, dstPath);
    else fs.copyFileSync(srcPath, dstPath);
  }
  return true;
}

// 0. Copy static icons back into dist because expo export clears them.
const ICONS_SRC = path.join(__dirname, "../../../myra_project");
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
  const dst = path.join(distDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`OK ${f} copied to dist/`);
  } else {
    console.warn(`WARN missing: ${src}`);
  }
}

// 1. Vercel rewrites.
const vercelJson = {
  rewrites: [
    { source: "/api/:path*", destination: "http://91.214.112.96:8001/:path*" },
    { source: "/assets/:path*", destination: "/assets/:path*" },
    { source: "/vendor-assets/:path*", destination: "/vendor-assets/:path*" },
    { source: "/_expo/:path*", destination: "/_expo/:path*" },
    { source: "/((?!api/|assets/|vendor-assets/|_expo/|favicon.ico|site.webmanifest|apple-touch-icon.png|android-chrome-192x192.png|android-chrome-512x512.png).*)", destination: "/index.html" },
  ],
};
fs.writeFileSync(path.join(distDir, "vercel.json"), JSON.stringify(vercelJson, null, 2));
console.log("OK dist/vercel.json patched");

// 1/b. Move font/icon assets out of an assets/node_modules URL.
const nodeAssetSrc = path.join(distDir, "assets/node_modules");
const vendorAssetDst = path.join(distDir, "vendor-assets");
if (copyDir(nodeAssetSrc, vendorAssetDst)) {
  const jsDir = path.join(distDir, "_expo/static/js/web");
  for (const f of fs.readdirSync(jsDir)) {
    if (!f.endsWith(".js")) continue;
    const jsPath = path.join(jsDir, f);
    const before = fs.readFileSync(jsPath, "utf8");
    const after = before.replaceAll("/assets/node_modules/", "/vendor-assets/");
    if (after !== before) fs.writeFileSync(jsPath, after, "utf8");
  }
  console.log("OK font and icon assets moved to dist/vendor-assets/");
}

// 2. index.html patch: iOS / PWA meta tags.
const indexPath = path.join(distDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

html = html.replace(
  /(<meta\s+name="viewport"\s+content=")[^"]*"/,
  '$1width=device-width, initial-scale=1, maximum-scale=1"'
);

const iosTags = [
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Myra">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">',
].join("");

if (!html.includes("mobile-web-app-capable")) {
  html = html.replace('<link rel="icon" href="/favicon.ico" />', iosTags + '<link rel="icon" href="/favicon.ico" />');
  fs.writeFileSync(indexPath, html, "utf8");
  console.log("OK dist/index.html patched");
} else {
  console.log("OK dist/index.html already patched");
}
