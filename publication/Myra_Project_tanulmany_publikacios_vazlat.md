# Myra Project: mérésvezérelt, reflektív mentálhigiénés digitális rendszer

**Publikációs kézirat - védett szakmai változat**

**Szerző:** Ódor Antal  
**Projekt:** Myra Project / ESV-modell  
**Verzió:** 2026. június 4.  

## Absztrakt

A Myra Project egy mérésvezérelt, reflektív mentálhigiénés digitális rendszer, amely a felhasználó önkitöltős állapotfelmérése alapján állapotkódot képez, majd erre építve személyre szabott, mesterséges intelligenciával támogatott beszélgetési folyamatot indít. A rendszer nem hivatalos diagnosztikai vagy terápiás eszköz, hanem önreflexiót, állapotkövetést és mentálhigiénés tájékozódást támogató digitális interfész. A projekt alapját az ESV-modell adja, amely több dimenzióban méri a felhasználó aktuális pszichés és testi-terhelési mintázatait, majd az eredményt egy előre definiált állapotkód-rendszerhez rendeli.

A jelen kézirat célja a Myra Project szakmai, technikai, adatvédelmi és etikai felépítésének áttekintése. A bemutatott empirikus alap egy 101 fős kérdőíves adatfelvétel, amely a modell négy fő dimenziójának belső konzisztenciáját és együttjárási mintázatait vizsgálta. Az adatok alapján az A, P és H dimenziók erős belső konzisztenciát mutattak, míg a C dimenzió közepes konzisztenciájú, ami a testi tünetek heterogén természetével összhangban értelmezhető. A Myra Project jelenlegi formájában kutatási és mentálhigiénés támogató rendszerként értelmezhető, amelynek további független validációja, hosszabb távú követéses hatásvizsgálata és külső szakmai értékelése erősen indokolt.

**Fontos megjegyzés:** a Myra Project nem hivatalos diagnosztikai eszköz, nem pszichoterápiás szolgáltatás, és nem helyettesíti a szakemberrel vagy sürgősségi ellátással történő kapcsolatfelvételt.

## Kulcsszavak

mentálhigiéné; mesterséges intelligencia; reflektív interfész; állapotfelmérés; ESV-modell; digitális önreflexió; adatvédelem; AI-etika

## 1. Bevezetés

A digitális mentálhigiénés eszközök 2026-ra széles körben elérhetővé váltak, azonban a mezőny jelentős része két pólus között mozog: egyrészt a tartalom- és gyakorlatközpontú wellness alkalmazások, másrészt az intézményi vagy klinikai ellátási folyamatokba illesztett triázs- és szűrőrendszerek között. E két megközelítés között kevés olyan rendszer található, amely egyszerre épít önkitöltős állapotfelmérésre, saját belső modellre, állapotkód-alapú értelmezésre és személyre szabott reflektív párbeszédre.

A Myra Project ebből a hiányból indul ki. A rendszer nem azt feltételezi, hogy a felhasználó első üzenete önmagában elegendő a mentálhigiénés állapot megértéséhez. Ehelyett a beszélgetés előtt egy strukturált mérési folyamatot használ, amely a felhasználó aktuális állapotáról többdimenziós képet ad. A chatbot-komponens ezután nem üres kontextusból indul, hanem a mérés eredményéből és a kapcsolódó állapotkódból.

A rendszer fejlesztésének alapgondolata, hogy a mentálhigiénés támogatás nem kizárólag a probléma megnevezéséből, hanem a felhasználó saját állapotához való reflektív viszonyának kialakításából áll. A Myra Project ezért nem diagnosztikai címkéket kíván adni, hanem strukturált, visszajelző és támogató keretet biztosít.

## 2. A rendszer pozicionálása

A Myra Project nem orvostechnikai eszköz, nem hivatalos diagnosztikai rendszer, nem pszichoterápiás szolgáltatás és nem helyettesíti a szakemberrel történő konzultációt. A rendszer célja:

- önreflexió támogatása,
- aktuális állapot követése,
- mentálhigiénés tájékozódás segítése,
- strukturált beszélgetési keret biztosítása,
- saját állapotmintázatok felismerésének elősegítése.

A rendszer működése során megjelenő állapotkódok és kategóriák belső modellhez kötött értelmezési egységek. Ezek nem tekintendők hivatalos diagnózisnak, nem helyettesítenek klinikai vizsgálatot, és nem alkalmasak önálló egészségügyi döntéshozatalra.

Ez a pozicionálás etikai és jogi szempontból kulcsfontosságú. A mentálhigiénés adatok különösen érzékeny természetűek, ezért a rendszer tervezésének középpontjában az adatminimalizálás, a hozzáférésvédelem, az átláthatóság és a felhasználói önrendelkezés áll.

## 3. Az ESV-modell rövid leírása

Az ESV-modell a felhasználó aktuális állapotát négy dimenzió mentén értelmezi. A dimenziók célja nem személyiségdiagnózis, hanem pillanatnyi vagy időszakos állapotmintázat leírása.

### 3.1. A dimenzió

Az A dimenzió a szorongásos, készenléti és belső feszültségi állapotokra vonatkozó tételeket foglalja össze. Ide tartoznak például az idegesség, aggodalom, nyugtalanság és ellazulási nehézség elemei.

### 3.2. P dimenzió

A P dimenzió a szabályozási, impulzuskontroll- és érzelmi feldolgozási mintázatokhoz kapcsolódik. A modellben fordított szabályozási skálaként értelmezhető: alacsonyabb értéke gyengébb önszabályozási kapacitást, magasabb értéke stabilabb adaptív működést jelez.

### 3.3. H dimenzió

A H dimenzió a stresszterhelés, kontrollvesztés és túlterheltség élményét írja le. Ez a dimenzió a mindennapi működésben megjelenő pszichés terhelés egyik fő mutatója.

### 3.4. C dimenzió

A C dimenzió testi, szomatikus panaszokat és terhelésjelzőket tartalmaz. Ide tartoznak például a fáradtság, fejfájás, szívdobogásérzés, alvászavar és hasi diszkomfort. A dimenzió heterogén jellege miatt belső konzisztenciája várhatóan alacsonyabb lehet, mint a tisztábban pszichés tételeket tartalmazó dimenzióké.

## 4. A Myra Project működési logikája

A rendszer működése négy fő lépésre bontható:

1. **Önkitöltős mérés:** a felhasználó kitölti az ESV-modell kérdőívét.
2. **Állapotkód képzése:** a rendszer a dimenzióeredmények alapján állapotkódot rendel a méréshez.
3. **Értelmezési keret létrehozása:** a kódhoz kapcsolódó belső leírás és profil meghatározza a beszélgetés kiindulópontját.
4. **Reflektív párbeszéd:** a chatbot a mérési eredményhez és a felhasználó aktuális üzeneteihez igazodva válaszol.

Ez a szerkezet különbözteti meg a rendszert az általános célú chatbotoktól. A beszélgetés nem pusztán a felhasználó első szöveges üzenetére épül, hanem egy előzetes mérési és értelmezési keretre.

## 5. Empirikus alap: 101 fős kérdőíves adatfelvétel

A rendelkezésre álló kérdőíves adatfelvétel 101 fő válaszait tartalmazta. A minta nem reprezentatív populációs minta, hanem előzetes empirikus vizsgálati alapként értelmezhető. A jelen kéziratban az adatfelvétel rekrutációs körülményei csak korlátozottan kerülnek bemutatásra; nyilvános tudományos közlés esetén ennek pontosabb módszertani leírása indokolt.

A válaszadók nem szerinti megoszlása a következő:

| Nem | Szám |
| --- | ---: |
| Nő | 76 |
| Férfi | 25 |
| **Összesen** | **101** |

A számított dimenzióeredmények 100 főnél voltak értékelhetők a kalkulációs lapon. A következő eredmények az aggregált, személyazonosításra nem alkalmas adatokon alapulnak.

## 6. Belső konzisztencia

A dimenziók belső konzisztenciáját Cronbach-alfa mutatóval becsültük. Az eredmények:

| Dimenzió | Tételek száma | Cronbach-alfa |
| --- | ---: | ---: |
| A | 6 | 0.906 |
| P | 6 | 0.874 |
| H | 4 | 0.846 |
| C | 5 | 0.658 |

Az A, P és H dimenziók belső konzisztenciája erős. A C dimenzió közepes konzisztenciát mutat, ami a testi tünetek sokfélesége miatt értelmezhető és nem feltétlenül modellhiba. A testi tünetek eltérő élettani és pszichés útvonalakon jelenhetnek meg, ezért az ilyen jellegű dimenzióknál természetes lehet a nagyobb belső szórás.

## 7. Dimenziók együttjárása

A normalizált dimenziók közötti korrelációk a következő mintázatot mutatták:

| Dimenzió | A | P | H | C |
| --- | ---: | ---: | ---: | ---: |
| A | 1.000 | -0.708 | 0.769 | 0.571 |
| P | -0.708 | 1.000 | -0.710 | -0.440 |
| H | 0.769 | -0.710 | 1.000 | 0.591 |
| C | 0.571 | -0.440 | 0.591 | 1.000 |

Az eredmények alapján az A, H és C dimenziók pozitívan járnak együtt, ami a szorongás, stresszterhelés és testi tünetek modell szerinti kapcsolatát támasztja alá. A P dimenzió ezzel szemben negatív kapcsolatot mutat az A, H és C dimenziókkal. Ez a mintázat összhangban van azzal, hogy a P dimenzió fordított szabályozási skálaként működik: alacsonyabb értéke gyengébb adaptív szabályozást, magasabb értéke stabilabb szabályozási kapacitást jelezhet.

Ez a mintázat a modell belső koherenciáját támogatja. Fontos azonban hangsúlyozni, hogy korrelációs eredményekből oksági következtetés nem vonható le.

## 8. Súlyossági kategóriák eloszlása

A 100 értékelhető eset belső állapotkód szerinti súlyossági eloszlása:

| Belső kategória | N | Arány |
| --- | ---: | ---: |
| LOW | 7 | 6.9% |
| NORMAL | 27 | 26.7% |
| ELEVATED | 32 | 31.7% |
| CRITICAL | 34 | 33.7% |
| **Összesen** | **100** | **100%** |

A "CRITICAL" megjelölés a modell belső állapotkód-rendszerének magas terhelési szintet jelölő kategóriája. Nem klinikai diagnózis, nem egészségügyi minősítés, és nem jelent hivatalos kockázatbesorolást. Publikációs és felhasználói kommunikációban javasolt ezt "magas terheltségi kategória" vagy "kiemelt figyelmet igénylő állapotmintázat" kifejezéssel magyarázni.

## 9. Technikai és adatvédelmi keretek

A Myra Project nyilvános dokumentációja nem ismerteti részletesen a rendszer belső technikai architektúráját. A publikáció szempontjából elegendő annak rögzítése, hogy a rendszer adatvédelmi kialakítása az adatminimalizálásra, a jogosultságok korlátozására, az érzékeny hozzáférési adatok védelmére és az európai adatkezelési követelmények figyelembevételére épül.

A felhasználói kommunikációban és szakmai leírásban a technikai részletek helyett az adatkezelési elvek, az etikai keretek és a rendszer korlátainak átlátható bemutatása indokolt.

Biztonsági okokból a jelen tanulmány nem tartalmaz:

- IP-címeket,
- domain- vagy infrastruktúra-részleteket,
- adatbázis-hostot,
- API-kulcsokat,
- belső promptokat,
- konkrét tudásbázis-szövegeket,
- felhasználói azonosítókat,
- egyedi beszélgetésrészleteket.

## 10. Adatvédelmi és biztonsági alapelvek

A Myra Project érzékeny mentálhigiénés információkat kezelhet. A rendszer ezért a következő elveket követi:

1. **Adatminimalizálás:** csak a működéshez szükséges adatok kezelése.
2. **Backend-only AI-hívás:** az AI API-kulcsok nem kerülnek kliensoldalra.
3. **EU adatbázis:** a felhasználói adatok EU régióban tárolódnak.
4. **Szerver-adatbázis szétválasztás:** a backend futtatókörnyezet nem tartalmaz lokális user-adatbázist.
5. **Admin hozzáférés korlátozása:** admin funkciók csak jogosult felhasználóval érhetők el.
6. **Aktivitásmonitoring:** az admin felületen látható a chatbot aktivitása, ami segíti a visszaélések korai felismerését.
7. **Törlési lehetőség:** a felhasználó törlésekor a kapcsolódó adatok törlésének elve érvényesül.
8. **Titkok védelme:** API-kulcsok, adatbázis-jelszavak és JWT titkok nem publikálhatók.

Az Európai Adatvédelmi Testület GDPR 9. cikkre vonatkozó iránymutatása szerint az egészséghez kapcsolódó adatok különleges kategóriájú személyes adatnak minősülhetnek. A Myra Project ezért a mentálhigiénés információkat fokozott óvatossággal kezeli.

## 11. Etikai keretek

A WHO mesterséges intelligencia egészségügyi alkalmazásairól szóló etikai iránymutatása kiemeli az emberi jogok, az átláthatóság, a felelősség és az emberi felügyelet fontosságát. A Myra Project etikai kialakítása ezekkel összhangban a következő elveket követi:

- a rendszer nem állít fel hivatalos diagnózist,
- nem helyettesít szakembert vagy sürgősségi ellátást,
- krízishelyzetekben biztonságorientált válaszkeretet használ,
- nem ösztönöz függőségi jellegű használatot,
- a felhasználói önrendelkezést és adatvédelmet elsődlegesnek tekinti,
- a rendszer működése dokumentálható és auditálható.

## 12. Jogilag óvatos kommunikációs javaslat

A Myra Project nyilvános kommunikációjában kerülendők az alábbi megfogalmazások:

- "diagnosztizál",
- "terápiát nyújt",
- "gyógyít",
- "klinikailag igazolt",
- "pszichoterápiát helyettesít",
- "orvosi/klinikai döntést hoz".

Javasolt kifejezések:

- "mentálhigiénés önreflexiós rendszer",
- "állapotkövető digitális eszköz",
- "mérésvezérelt reflektív interfész",
- "AI-támogatott beszélgetési keret",
- "nem helyettesíti a szakemberrel történő konzultációt",
- "nem hivatalos diagnosztikai eszköz".

## 13. A rendszer újdonságértéke

A Myra Project újdonságértéke nem abban áll, hogy mesterséges intelligenciával beszélgetést folytat. Ez 2026-ban önmagában már nem különleges. A projekt sajátossága a következő elemek integrációjában áll:

- saját mentálhigiénés állapotmodell,
- kérdőíves mérési előzmény,
- állapotkód-alapú beszélgetési indítás,
- tudásbázissal támogatott reflektív válaszadás,
- alacsony költségű, fenntartható infrastruktúra,
- adatbiztonsági szempontból elkülönített architektúra.

Ez alapján a Myra Project nem egyszerű chatbotként, hanem modellvezérelt mentálhigiénés interfészként írható le.

## 14. Korlátok

A jelenlegi rendszer és adatbázis több korláttal rendelkezik:

1. A 101 fős minta nem reprezentatív.
2. A vizsgálat előzetes empirikus alap, nem külső független validáció.
3. Nincs hosszú távú, kontrollált követéses hatásvizsgálat.
4. A chatbot-válaszok minősége részben a használt LLM-modelltől függ.
5. A belső állapotkódok nem hivatalos diagnózisok.
6. A "CRITICAL" jelölés belső súlyossági címke, nem klinikai diagnózis és nem egészségügyi minősítés.
7. A rendszer szenzitív adatokat érinthet, ezért folyamatos adatvédelmi felülvizsgálat indokolt.

E korlátok nem teszik érvénytelenné a rendszert, de meghatározzák, milyen állítások tehetők róla felelősen.

## 15. Jövőbeli fejlesztési és kutatási irányok

A következő kutatási és szakmai irányok indokoltak:

- hosszabb távú mérési trendek vizualizációja,
- kérdőív ismételt kitöltése alapján változáskövetés,
- független szakmai visszajelzések gyűjtése,
- publikációs szintű módszertani dokumentáció,
- adatvédelmi tájékoztató és felhasználási feltételek finomítása.

A működtetés szintjén külön technikai fejlesztési irányt jelenthet a regisztrációs visszaélések szűrése, a használati limitek finomítása és az adminisztratív aktivitásmonitoring bővítése.

## 16. Következtetés

A Myra Project egy többéves kutatási és fejlesztési folyamat eredményeként létrejött, mérésvezérelt, reflektív mentálhigiénés digitális rendszer. A projekt jelenlegi formájában működő alkalmazás, saját modell, előzetes empirikus adatfelvétel, tudásbázis és AI-támogatott beszélgetési keret integrációja.

A 101 fős kérdőíves adatfelvétel alapján az ESV-modell több fő dimenziója erős belső konzisztenciát mutat, és a dimenziók közötti együttjárások a modell belső logikájával összhangban állnak. Ez előzetes empirikus alátámasztást ad a rendszernek, ugyanakkor nem helyettesíti a további, független validációt.

A Myra Project felelős megfogalmazásban nem klinikai diagnosztikai vagy terápiás rendszerként, hanem empirikus alapon fejlesztett, AI-támogatott reflektív mentálhigiénés interfészként írható le. A rendszer különös értéke abban áll, hogy a beszélgetést nem önmagában kezeli, hanem mérési eredményhez és állapotkódhoz kapcsolja, miközben adatvédelmi és etikai szempontból óvatos működési keretre épül. A rendszer használata nem helyettesíti a szakemberrel történő konzultációt, hivatalos diagnózist vagy sürgősségi ellátást.

## 17. Publikációs megjegyzés

A tanulmány jelen formája publikációs vázlat. Nyilvános megjelenés előtt javasolt:

- jogi/adatvédelmi átnézés,
- az "állapotkód" és "diagnózis" terminológia következetes finomítása,
- a mérési módszertan részletesebb dokumentálása,
- a kérdőíves minta rekrutációs körülményeinek leírása,
- anonimizált statisztikai melléklet készítése,
- a felhasználói kommunikáció és disclaimer pontosítása.

## Hivatkozások

1. World Health Organization. *Ethics and governance of artificial intelligence for health: WHO guidance*. WHO, 2021.  
   https://www.who.int/publications/i/item/9789240029200

2. European Data Protection Board. *GDPR Article 9: Processing of special categories of personal data*.  
   https://www.edpb.europa.eu/gdpr-articles/article-9-processing-special-categories-personal-data_en

3. European Commission. *Artificial Intelligence in healthcare*.  
   https://health.ec.europa.eu/ehealth-digital-health-and-care/artificial-intelligence-healthcare_en

4. European Commission. *AI Act enters into force*. 2024.  
   https://commission.europa.eu/news/ai-act-enters-force-2024-08-01_en
