# CourseHub

Tárgyfelvételi rendszer bejelentkezéssel. Hallgatók a teljes katalógusból vesznek fel tárgyakat,
az oktatók csak a saját kurzusaikat látják és kezelik.

```
coursehub/
├── backend/    Node.js + Express + TypeORM (MySQL)
└── frontend/   Angular 20 + Tailwind CSS 4
```

## Követelmények
- Node.js 22.12+ (Angular 20-hoz) 
- WAMP (vagy bármilyen MySQL/MariaDB), a MySQL szolgáltatás fusson (alapértelmezett port: 3306)

## 1. Backend indítása
```bash
cd backend
npm install
# .env már létezik – WAMP alapbeállítással (root, üres jelszó). Ha nálad más, írd át.
npm run dev
```
Első indításkor a szerver:
1. létrehozza a `coursehub` adatbázist, ha nincs,
2. létrehozza a táblákat (TypeORM `synchronize`),
3. létrehozza a kezdő felhasználókat (csak ha a `users` tábla üres). Kurzusokat az oktatók vesznek fel a felületen.

API: http://localhost:3000/api

## 2. Frontend indítása
```bash
cd frontend
npm install
npm start
```
Megnyitás: http://localhost:4200 (a backend címe: `frontend/src/app/core/config.ts`).

## Kezdő felhasználók (jelszó mindegyiknek: `Jelszo123`)
| Szerepkör | Név | E-mail |
|---|---|---|
| Hallgató | Kovács Alex | alex.kovacs@egyetem.hu |
| Hallgató | Szabó Dóra | dora.szabo@egyetem.hu |
| Oktató | Dr. Rostova Elena | elena.rostova@egyetem.hu |
| Oktató | Prof. Vance Marcus | marcus.vance@egyetem.hu |
| Oktató | Dr. Lin Sarah | sarah.lin@egyetem.hu |

Regisztráció nincs: új felhasználót a `users` táblába kell felvenni (a jelszó bcrypt hash).

## API
| Metódus | Útvonal | Jogosultság |
|---|---|---|
| POST | /api/auth/login | – |
| GET | /api/auth/me | bejelentkezett |
| GET | /api/courses | hallgató (teljes katalógus) |
| GET | /api/courses/mine | oktató (csak saját kurzusok) |
| POST | /api/courses | oktató |
| DELETE | /api/courses/:id | oktató, csak a saját kurzusát |
| GET | /api/enrollments | hallgató (saját jelentkezések) |
| POST | /api/enrollments | hallgató |
| DELETE | /api/enrollments/:id | hallgató (saját) |

## E-mail értesítés (opcionális)
Ha egy leiratkozás vagy csoportváltás után a várólistáról valaki bekerül a kurzusra, e-mailt kap.
A `backend/.env`-ben add meg a Gmail-címet és egy alkalmazásjelszót (2 lépéses azonosítás kell hozzá,
https://myaccount.google.com/apppasswords):
```
SMTP_USER=te@gmail.com
SMTP_PASS=abcdefghijklmnop
```
Ha üresek, az e-mail küldés ki van kapcsolva. A küldés hibája nem akadályozza a leiratkozást.
