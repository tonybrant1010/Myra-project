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

// 0. Copy static icons + manifest back into dist because expo export clears them.
//    Source of truth lives in-repo at frontend/web-icons/ (regenerate via scripts/gen-icons.js).
const ICONS_SRC = path.join(__dirname, "../web-icons");
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

// 1. Vercel routing source of truth is frontend/vercel.json.
const vercelJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"),
);
fs.writeFileSync(path.join(distDir, "vercel.json"), JSON.stringify(vercelJson, null, 2));
console.log("OK dist/vercel.json patched");

// Create dist/api directory and write proxy.js
const apiDir = path.join(distDir, "api");
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

const proxyCode = `
module.exports = async function handler(req, res) {
  const path = req.query.path || '';
  const cleanPath = path.startsWith('api/') ? path : \`api/\${path}\`;
  let backendOrigin = (process.env.MYRA_BACKEND_ORIGIN || process.env.BACKEND_URL || "http://35.253.246.219:8001").trim();
  while (backendOrigin.endsWith('/')) backendOrigin = backendOrigin.slice(0, -1);
  const targetUrl = new URL(\`\${backendOrigin}/\${cleanPath}\`);
  
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path') {
      targetUrl.searchParams.append(key, value);
    }
  }

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() !== 'host') {
      headers[key] = value;
    }
  }
  headers['X-Myra-Proxy-Secret'] = process.env.MYRA_PROXY_SECRET || '';

  let body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve) => {
      let chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'manual'
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = await response.arrayBuffer();
    res.send(Buffer.from(responseBody));
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(502).json({ detail: "Proxy error connecting to origin." });
  }
}
`;

fs.writeFileSync(path.join(apiDir, "proxy.js"), proxyCode.trim());
console.log("OK dist/api/proxy.js written");


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
let html;
let retries = 5;
while (retries > 0) {
  try {
    html = fs.readFileSync(indexPath, "utf8");
    break;
  } catch (e) {
    if (e.code === "ENOENT" && retries > 1) {
      console.log("Waiting for index.html to be written (Windows filesystem delay)...");
      const start = Date.now();
      while (Date.now() - start < 500) {}
      retries--;
    } else {
      throw e;
    }
  }
}


html = html.replace(
  /(<meta\s+name="viewport"\s+content=")[^"]*"/,
  '$1width=device-width, initial-scale=1, maximum-scale=1"'
);

// Tab / "Add to Home Screen" default name.
html = html.replace(/<title>[^<]*<\/title>/, "<title>Myra Project</title>");

const iosTags = [
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Myra Project">',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
  '<link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon.png">',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
  '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
  '<link rel="manifest" href="/site.webmanifest">',
].join("");

if (!html.includes("mobile-web-app-capable")) {
  html = html.replace('<link rel="icon" href="/favicon.ico" />', iosTags + '<link rel="icon" href="/favicon.ico" />');
  fs.writeFileSync(indexPath, html, "utf8");
  console.log("OK dist/index.html patched");
} else {
  console.log("OK dist/index.html already patched");
}
