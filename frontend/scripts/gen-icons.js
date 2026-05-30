/**
 * Ikon generáló script – uj_logo1.png alapján legenerálja az összes szükséges
 * app ikont és favicon fájlt.
 */
const path = require("path");
const fs = require("fs");

const SRC = path.join(__dirname, "../assets/images/uj_logo1.png");
const ASSETS = path.join(__dirname, "../assets/images");
const ICONS_DIR = path.join(__dirname, "../../../myra_project");

async function run() {
  let sharp;
  try {
    // Először a helyi node_modules-ból próbálja, majd az npm global path-ból
    const sharpPath = path.join(__dirname, "../node_modules/sharp");
    sharp = require(sharpPath);
  } catch (e) {
    try {
      sharp = require("sharp");
    } catch (e2) {
      console.error("sharp nincs telepítve. Futtasd: npm install sharp --save-dev");
      process.exit(1);
    }
  }

  const sizes = [
    // Expo / natív ikonok
    { file: path.join(ASSETS, "icon.png"),          size: 1024 },  // iOS + általános
    { file: path.join(ASSETS, "adaptive-icon.png"), size: 1024 },  // Android adaptive foreground
    { file: path.join(ASSETS, "favicon.png"),       size: 48   },  // Expo web favicon

    // Web favicon variánsok (myra_project mappa = dist ikonok)
    { file: path.join(ICONS_DIR, "favicon-16x16.png"),          size: 16  },
    { file: path.join(ICONS_DIR, "favicon-32x32.png"),          size: 32  },
    { file: path.join(ICONS_DIR, "apple-touch-icon.png"),       size: 180 },
    { file: path.join(ICONS_DIR, "android-chrome-192x192.png"), size: 192 },
    { file: path.join(ICONS_DIR, "android-chrome-512x512.png"), size: 512 },
  ];

  for (const { file, size } of sizes) {
    await sharp(SRC)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(file);
    console.log(`OK  ${size}x${size}  →  ${path.relative(process.cwd(), file)}`);
  }

  // favicon.ico (16 + 32 beleégetve)
  const icoPath = path.join(ICONS_DIR, "favicon.ico");
  // ICO = 32x32 PNG, böngészők elfogadják
  await sharp(SRC).resize(32, 32).png().toFile(icoPath);
  console.log(`OK  32x32  →  ${path.relative(process.cwd(), icoPath)}`);

  console.log("\nMinden ikon elkészült.");
}

run().catch((e) => { console.error(e); process.exit(1); });
