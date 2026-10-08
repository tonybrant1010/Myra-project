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


const vercelJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"),
);
fs.writeFileSync(path.join(distDir, "vercel.json"), JSON.stringify(vercelJson, null, 2));
console.log("OK dist/vercel.json patched");


const apiDir = path.join(distDir, "api");
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

const proxyCode = `
const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(self), payment=(), usb=(), magnetometer=(), gyroscope=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'X-Permitted-Cross-Domain-Policies': 'none',
};
function envNumber(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(value, max));
}

const normalRequestMaxBytes = envNumber('API_REQUEST_MAX_BYTES', 1024 * 1024, 64 * 1024, 10 * 1024 * 1024);
const uploadRequestMaxBytes = envNumber('KB_PDF_UPLOAD_MAX_BYTES', 25 * 1024 * 1024, 1024 * 1024, 100 * 1024 * 1024);
// A lánc sorrendje: backend LLM-keret (45s) < proxy timeout (55s) < Vercel függvény-limit (60s).
// Korábban a proxy 30s-nál bontott, miközben a backend még percekig dolgozott.
const proxyTimeoutMs = envNumber('MYRA_PROXY_TIMEOUT_MS', 55000, 5000, 120000);

function requestBodyLimit(cleanPath) {
  return cleanPath === 'api/admin/kb/files/upload' || cleanPath === 'api/admin/kb/upload'
    ? uploadRequestMaxBytes
    : normalRequestMaxBytes;
}

function isSafeProxyPath(cleanPath) {
  if (!cleanPath || cleanPath.includes('\\\\') || cleanPath.includes('\\0')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleanPath) || cleanPath.startsWith('//')) return false;
  return cleanPath.split('/').every((segment) => segment !== '..' && segment !== '.');
}

module.exports = async function handler(req, res) {
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : (req.query.path || '');
  const cleanPath = path.startsWith('api/') ? path : \`api/\${path}\`;
  if (!isSafeProxyPath(cleanPath)) {
    for (const [key, value] of Object.entries(securityHeaders)) {
      res.setHeader(key, value);
    }
    res.status(400).json({ detail: 'Invalid proxy path.' });
    return;
  }
  let backendOrigin = (process.env.MYRA_BACKEND_ORIGIN || process.env.BACKEND_URL || '').trim();
  const proxySecret = (process.env.MYRA_PROXY_SECRET || '').trim();
  if (!backendOrigin || !proxySecret) {
    for (const [key, value] of Object.entries(securityHeaders)) {
      res.setHeader(key, value);
    }
    res.status(500).json({ detail: 'Proxy configuration is incomplete.' });
    return;
  }
  while (backendOrigin.endsWith('/')) backendOrigin = backendOrigin.slice(0, -1);
  const targetUrl = new URL(\`\${backendOrigin}/\${cleanPath}\`);

  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path') {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        targetUrl.searchParams.append(key, item);
      }
    }
  }

  const headers = {};
  const hopByHopHeaders = new Set([
    'host',
    'connection',
    'cookie',
    'keep-alive',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'content-length',
    // A kliens NEM adhatja meg ezeket: a proxy-titkot mi állítjuk be (a kliens értéke
    // egyébként a fetch Headers append-szemantikája miatt "kliens, valodi" formában
    // fuzionalna, es a backend 403-mal utasitana el), a kliens-IP fejleceket pedig
    // a Vercel tolti ki - egy tovabbitott sajat ertek meghamisitana a rate limiteket.
    'x-myra-proxy-secret',
    'x-forwarded-for',
    'x-real-ip',
  ]);
  for (const [key, value] of Object.entries(req.headers)) {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      headers[key] = value;
    }
  }
  const clientIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '')
    .toString()
    .split(',')[0]
    .trim();
  if (clientIp) headers['X-Forwarded-For'] = clientIp;
  headers['X-Myra-Proxy-Secret'] = proxySecret;
  const bodyLimit = requestBodyLimit(cleanPath);
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength && declaredLength > bodyLimit) {
    res.status(413).json({ detail: 'A kérés túl nagy.' });
    return;
  }

  try {
    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise((resolve, reject) => {
        let chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
          total += chunk.length;
          if (total > bodyLimit) {
            reject(new Error('REQUEST_TOO_LARGE'));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), proxyTimeoutMs);
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: headers,
      body: body,
      redirect: 'manual',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    res.status(response.status);
    const blockedResponseHeaders = new Set([
      'connection',
      'content-encoding',
      'content-length',
      'keep-alive',
      'proxy-authenticate',
      'proxy-authorization',
      'set-cookie',
      'te',
      'trailer',
      'transfer-encoding',
      'upgrade',
    ]);
    response.headers.forEach((value, key) => {
      if (!blockedResponseHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    for (const [key, value] of Object.entries(securityHeaders)) {
      res.setHeader(key, value);
    }

    // Folyamatos kiírás (SSE, /api/chat/send-stream): darabonként továbbítjuk,
    // nem gyűjtjük be a teljes választ. A proxy-időkorlát a fejlécek megérkezéséig él.
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('text/event-stream') && response.body) {
      res.setHeader('Cache-Control', 'no-store, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      const reader = response.body.getReader();
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          res.write(Buffer.from(chunk.value));
        }
      } catch (streamError) {
        console.error('Proxy stream error:', streamError);
      }
      res.end();
      return;
    }

    const responseBody = await response.arrayBuffer();
    res.send(Buffer.from(responseBody));
  } catch (error) {
    console.error("Proxy error:", error);
    for (const [key, value] of Object.entries(securityHeaders)) {
      res.setHeader(key, value);
    }
    if (error && error.message === 'REQUEST_TOO_LARGE') {
      res.status(413).json({ detail: 'A kérés túl nagy.' });
      return;
    }
    if (error && error.name === 'AbortError') {
      res.status(504).json({ detail: "Proxy timeout connecting to origin." });
      return;
    }
    res.status(502).json({ detail: "Proxy error connecting to origin." });
  }
}
`;

fs.writeFileSync(path.join(apiDir, "proxy.js"), proxyCode.trim());
console.log("OK dist/api/proxy.js written");


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

let indexChanged = false;

if (!html.includes("mobile-web-app-capable")) {
  html = html.replace('<link rel="icon" href="/favicon.ico" />', iosTags + '<link rel="icon" href="/favicon.ico" />');
  indexChanged = true;
}


// --- Nappali / ejszakai paletta -------------------------------------------
//
// A palettat ITT kell beszurni, nem az app/+html.tsx-ben: az app.json-ban
// web.output = "single", es ilyenkor az Expo Router nem hasznalja a +html.tsx-et,
// hanem a sajat alap sablonjabol general index.html-t. (2026-08-16-an ellenorizve:
// az exportalt fajlban lang="en" all, a +html.tsx-ben viszont lang="hu".)
//
// A boot szkript az elso festes ELOTT visszaallitja a korabban valasztott modot,
// kulonben minden oldalbetoltesnel felvillanna a nappali paletta.
const themeCssPath = path.join(__dirname, "theme-tokens.css");
const themeBoot =
  'try{if(localStorage.getItem("myra.theme.mode")==="night")' +
  'document.documentElement.setAttribute("data-theme","night")}catch(e){}';

if (!html.includes("--myra-bg")) {
  if (!fs.existsSync(themeCssPath)) {
    throw new Error(
      "Hianyzik a scripts/theme-tokens.css. Enelkul minden szin feloldatlan " +
      "var(--myra-*) maradna, vagyis az oldal szinek nelkul menne ki."
    );
  }
  const themeCss = fs.readFileSync(themeCssPath, "utf8");
  const themeBlock =
    "<style id=\"myra-theme-tokens\">" + themeCss + "</style>" +
    "<script>" + themeBoot + "</script>";

  if (!html.includes("</head>")) {
    throw new Error("Nem talalom a </head> zaro tagot a dist/index.html-ben.");
  }
  html = html.replace("</head>", themeBlock + "</head>");
  indexChanged = true;
}

if (indexChanged) {
  fs.writeFileSync(indexPath, html, "utf8");
  console.log("OK dist/index.html patched (ikonok + nappali/ejszakai paletta)");
} else {
  console.log("OK dist/index.html already patched");
}


// Vegso ellenorzes: ha a paletta barmi miatt nem kerult be, inkabb alljon meg
// a deploy, mint hogy szinek nelkuli oldal menjen ki.
const vegleges = fs.readFileSync(indexPath, "utf8");
if (!vegleges.includes("--myra-bg") || !vegleges.includes("myra.theme.mode")) {
  throw new Error("A paletta nem kerult be a dist/index.html-be - a deploy leall.");
}
console.log("OK paletta ellenorizve a dist/index.html-ben");
