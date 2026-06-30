export const gdprText = `ADATKEZELÉSI TÁJÉKOZTATÓ

Hatályos: 2026. június 30.

1. Az adatkezelő
Név: Ódor Antal
Email: odor-antal@research.hu
Tevékenység jellege: magánszemélyként végzett, nem kereskedelmi célú kutatási és fejlesztési projekt

2. A szolgáltatás és az adatkezelés célja
A Myra egy mérésvezérelt, reflektív mentálhigiénés önismereti alkalmazás. Az adatkezelés célja:
- felhasználói fiók létrehozása és azonosítása,
- az alkalmazás biztonságos működtetése,
- kérdőíves állapotfelmérés rögzítése,
- belső állapotkód képzése és megjelenítése,
- személyre szabott chatbot-beszélgetés biztosítása,
- korábbi mérési és beszélgetési adatok visszanézhetősége,
- visszaélések, túlterhelés és jogosulatlan hozzáférés megelőzése,
- hibakeresés, biztonsági ellenőrzés és működésfenntartás.

3. Kezelt adatok köre
Az alkalmazás az alábbi adatokat kezelheti:
- név,
- email cím,
- jelszó titkosított, visszafejthetetlen formában,
- regisztráció és bejelentkezés időpontja,
- kérdőívre adott válaszok,
- belső állapotkód és mérési eredmények,
- chat üzenetek tartalma,
- chatbot-válaszok,
- a beszélgetéshez kapcsolódó, az alkalmazás által visszakeresett tudásanyag-részletek technikai felhasználása,
- felhasználói aktivitási adatok az alkalmazás működtetéséhez szükséges mértékben,
- technikai naplóadatok, például hibák, hozzáférési próbálkozások, IP-cím vagy eszköz-/böngészőinformáció, ha ez biztonsági vagy működtetési okból szükséges.

4. Különleges adatok és kifejezett hozzájárulás
A Myra használata során a felhasználó mentális állapotára, érzelmi terhelésére, stressz-szintjére vagy egészségi állapotára utaló információk is megjelenhetnek. Ezek az adatok a GDPR 9. cikke alapján különleges kategóriájú személyes adatnak minősülhetnek.

Az ilyen adatok kezelése a felhasználó kifejezett, önkéntes hozzájárulásán alapul a GDPR 9. cikk (2) bekeznés a) pontja szerint. A regisztrációval és a tájékoztató elfogadásával a felhasználó kifejezetten hozzájárul ahhoz, hogy a Myra az alkalmazás működéséhez szükséges mértékben ilyen adatokat kezeljen.

5. Az adatkezelés jogalapja
Az adatkezelés fő jogalapja a felhasználó önkéntes hozzájárulása:
- GDPR 6. cikk (1) bekezdés a) pont: hozzájárulás,
- GDPR 9. cikk (2) bekezdés a) pont: különleges adatok kezeléséhez adott kifejezett hozzájárulás.

Biztonsági, visszaélés-megelőzési és működésfenntartási célú technikai adatkezelés esetén az adatkezelő jogos érdeke is felmerülhet a GDPR 6. cikk (1) bekezdés f) pontja alapján. Ez nem terjed ki a szükséges mértéken túlmutató mentálhigiénés tartalomelemzésre.

6. Adattárolás helye és adatbiztonság
A felhasználói adatbázis (Supabase) európai uniós régióban (Frankfurt) működő adatbázis-szolgáltatáson keresztül, titkosítva kerül tárolásra. A webalkalmazás kiszolgáló és futtató környezetei (Vercel, Google Cloud) az Egyesült Államokban működhetnek, azonban ezeken a szervereken semmilyen állandó adat (adatbázis) nem tárolódik, kizárólag a kérések átmeneti feldolgozása történik a memóriában (in-memory).

A rendszer kialakítása törekszik arra, hogy a backend és az adatbázis elkülönítetten működjön, és a kliensoldali felület ne tartalmazzon AI API-kulcsot vagy közvetlen adatbázis-hozzáférést. A jelszavak egyirányú hash formában kerülnek tárolásra. Az adatkezelő törekszik a hozzáférések korlátozására, az érzékeny adatok védelmére, a technikai naplók és admin funkciók ésszerű korlátozására, valamint arra, hogy az adatokhoz csak indokolt esetben legyen hozzáférés.

A PDF alapú tudásanyag indexelése technikai keresési célt szolgál. A rendszer a tudásanyagból vektoros kereséshez szükséges embeddingeket tárolhat a Supabase adatbázisban. Ezek a felhasználói beszélgetésektől elkülönített technikai keresési adatok.

A beszélgetés TXT exportja a felhasználó kifejezett műveletére, a böngészőben készül el a már betöltött üzenetekből. Az alkalmazás külön szerveroldali exportfájlt nem hoz létre és nem tárol.

7. Külső szolgáltatók és adattovábbítás
A chatbot és az élő hangalapú asszisztens működéséhez a felhasználó üzeneteinek tartalma és bemeneti hanganyaga külső mesterséges intelligencia szolgáltatókhoz (különösen: Google Gemini, OpenAI, Anthropic) továbbítódik a válaszok és hanganyagok generálása céljából.

A chatbot-válasz generálásakor az aktuális üzenet mellett a beszélgetés korábbi, az alkalmazás működéséhez szükséges részletei, a felhasználó aktuális állapotkódjához kapcsolódó információk, valamint a PDF alapú tudásanyagból visszakeresett releváns részletek is bekerülhetnek a mesterséges intelligencia szolgáltatónak küldött kontextusba. Ez a beszélgetés folytonosságát és a válasz szakmai illeszkedését szolgálja.

Ez az adattovábbítás kizárólag a szolgáltatás működéséhez szükséges mértékben történik. A továbbítás az adott szolgáltatók hivatalos fejlesztői (Enterprise/API) felületein keresztül zajlik, amelyek szerződéses feltételei kifejezetten garantálják, hogy a Myra által beküldött adatokat és üzeneteket a szolgáltatók bizalmasan kezelik, és nem használják fel saját modelljeik tanítására vagy fejlesztésére.

A szolgáltatás működéséhez igényve vett külső szolgáltatók lehetnek különösen:
- tárhely-, frontend- vagy backend-szolgáltatók (Vercel, Google Cloud),
- adatbázis-szolgáltató (Supabase),
- mesterséges intelligencia szolgáltatók (Google, OpenAI, Anthropic),
- biztonsági, naplózási vagy üzemeltetési szolgáltatások.

8. Adatmegőrzési idő
Az adatok a felhasználói fiók aktív fennállásáig kerülnek megőrzésre. Mivel a Myra egy nonprofit kutatási és önismereti projekt, jogszabály nem írja elő az adatok kötelező megőrzési idejét.

A felhasználó bármikor kezdeményezheti fiókja és kapcsolódó adatainak azonnali és végleges törlését a Beállítások menüben a "Fiók törlése" gombbal, vagy e-mailben: odor-antal@research.hu. A törlés során a felhasználói profil, a mérési eredmények (kérdőívek), a megbízható eszközök és az összes chat beszélgetés előzménye véglegesen törlődik a futó adatbázisból. A hozzájárulás visszavonása a fiók és az adatok törlésének kérésével történhet. A hozzájárulás visszavonása nem érinti a visszavonás előtti adatkezelés jogszerűségét.

9. A felhasználó jogai
A felhasználó a GDPR alapján jogosult:
- tájékoztatást kérni az adatkezelésről,
- hozzáférni a róla kezelt adatokhoz,
- kérni az adatok helyesbítését,
- kérni az adatok törlését (a Beállítások menüben közvetlenül és azonnal végrehajtható),
- kérni az adathordozhatóságot (a GDPR 20. cikke alapján a Beállítások -> 'Adatok letöltése' menüpontban közvetlenül letölthető a teljes profil és chat előzmény gépileg olvasható JSON formátumban),
- kérni az adatkezelés korlátozását,
- tiltakozni a jogos érdeken alapuló adatkezelés ellen,
- hozzájárulását visszavonni,
- panaszt tenni a Nemzeti Adatvédelmi és Információszabadság Hatóságnál.

NAIH elérhetőség:
Nemzeti Adatvédelmi és Információszabadság Hatóság
Web: https://www.naih.hu

10. Automatizált döntéshozatal
A Myra nem hoz hivatalos joghatással járó vagy a felhasználót hasonlóan jelentős mértékben érintő automatizált döntést. Az állapotkódok, kategóriák és chatbot-válaszok tájékoztató, önismereti és reflektív célú visszajelzések, nem hivatalos diagnózisok és nem egészségügyi döntések.

11. Kiskorúak
Az alkalmazás 18 éven aluli személyek számára nem elérhető. A regisztrációval a felhasználó kijelenti, hogy betöltötte a 18. életévét.

12. Cookie-k és helyi tárolás
Az alkalmazás a biztonságos működéshez szükséges munkamenet-azonosító (JWT) tokent tárolja a felhasználó készülékén. A biztonsági kockázatok minimalizálása érdekében a bejelentkezési munkamenet adminisztrátorok esetében 1 óra, míg normál felhasználók esetében legfeljebb 7 nap tétlenség után lejár, és automatikus kijelentkezést von maga után. Marketing vagy hirdetési célú nyomkövető cookie használata nem célja a rendszernek.

13. Adatvédelmi incidens
Adatvédelmi incidens gyanúja esetén az adatkezelő megteszi a szükséges technikai és szervezési lépéseket, és ha a GDPR alapján indokolt, értesíti az illetékes hatóságot és az érintetteket.

14. A tájékoztató módosítása
Az adatkezelő jogosult a tájékoztatót módosítani, különösen technikai, adatvédelmi, jogszabályi vagy működésbeli változás esetén. A lényeges változásokról a felhasználók az alkalmazáson keresztül vagy más megfelelő módon tájékoztatást kaphatnak.`;
