# AI prompt napló – CourseHub

## 1. Frontend prototípus készítése Gemini Canvasban

**Prompt:** Készíts egy CourseHub nevű egyetemi tárgyfelvételi rendszerhez reszponzív Angular felületet. Legyen benne hallgatói és oktatói nézet, tárgykatalógus, felvett tárgyak listája, órarend és kurzuskezelés. A felület legyen modern és átlátható, egyelőre mintaadatokkal működjön, és egyetlen TypeScript fájlban készüljön el.

## 2. A prototípus továbbfejlesztése Claude segítségével

**Prompt:** A mellékelt TypeScript fájl egy már elkészült CourseHub frontend prototípusa. Ebből kiindulva készíts egy teljes, futtatható webalkalmazást. Hozd létre a szükséges adatbázismodellt és API-végpontokat, majd kapcsold össze a meglévő frontenddel. A backend Node.js, Express és TypeScript alapú legyen, az adatbázis kezelésére pedig TypeORM-ot és MySQL-t használj. Lehetőleg őrizd meg az eredeti felület megjelenését és funkcióit.

## 3. Bejelentkezés és jogosultságok

**Prompt:** Egészítsd ki a rendszert bejelentkezéssel és szerepköralapú jogosultságkezeléssel. Két szerepkör legyen: hallgató és oktató. A hitelesítéshez JWT-t használj, a jelszavakat pedig bcrypt segítségével kezeld. Regisztrációs felület nem szükséges. A hallgatók a saját tárgyaikat kezelhessék, az oktatók pedig a saját kurzusaikat.

## 4. Tárgyfelvételi szabályok és előfeltételek

**Prompt:** Bővítsd a tárgyfelvételi folyamatot előfeltételekkel és ellenőrzésekkel. A hallgató csak akkor vehessen fel egy tárgyat, ha teljesítette a szükséges előfeltételeket. Figyelj a kreditkeretre, a csoportok férőhelyeire, a már felvett tárgyakra és az órarendi ütközésekre is.

## 5. Várólista kialakítása

**Prompt:** Készíts várólistát a betelt kurzuscsoportokhoz. Ha egy hallgató lejelentkezik, a várólistán következő megfelelő jelentkező automatikusan bekerülhessen a felszabadult helyre. A várólista működjön csoportváltás esetén is, és ne lehessen ugyanarra a csoportra többször jelentkezni.

## 6. E-mail-értesítések a várólistáról bekerülő hallgatóknak

**Prompt:** Egészítsd ki a várólistát e-mail-értesítéssel. Használj Nodemailert és Gmail SMTP-kapcsolatot, a hitelesítési adatokat pedig a `.env` fájlból olvasd be változókon keresztül. A Gmail alkalmazásjelszóval történő beállítást is vedd figyelembe. A hallgató kapjon értesítést, ha a várólistáról automatikusan bekerül egy kurzusra. Az e-mail-küldés hibája ne akadályozza a tárgyfelvételi műveletet.

## 7. Demoadatok eltávolítása és a rendszer véglegesítése

**Prompt:** Távolítsd el a frontendből a demóhoz használt, beégetett mintaadatokat. A tantárgyak, kurzusok, jelentkezések és órarendi adatok helyett a valódi API-ból érkező adatokat használd. A fejlesztés és a kipróbálás megkönnyítése érdekében a kezdő hallgatói és oktatói felhasználók maradjanak meg.