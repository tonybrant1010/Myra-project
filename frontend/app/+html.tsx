// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * FIGYELEM: ez a fájl jelenleg NEM része a webes buildnek.
 *
 * Az app.json-ban `web.output: "single"` van beállítva, és ilyenkor az Expo Router
 * nem ezt a sablont használja, hanem a sajátjából generálja a dist/index.html-t.
 * 2026-08-16-án ellenőrizve: az exportált fájlban `lang="en"` áll, itt viszont
 * `lang="hu"`, és az alábbi <style> blokk sem jelenik meg benne.
 *
 * Ezért a nappali/éjszakai paletta NEM itt él, hanem:
 *   - scripts/theme-tokens.css   (a színek egyetlen forrása)
 *   - scripts/patch-dist.js      (build után beszúrja a dist/index.html <head>-jébe)
 *
 * Ha valaha `output: "static"`-ra váltasz, ez a fájl újra élővé válik — akkor a
 * theme-tokens.css tartalmát ide is be kell húzni, különben duplán vagy sehol
 * nem lesz meg a paletta.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="hu" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
