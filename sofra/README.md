# SOFRA — Lebanese Restaurant Menu & Ordering (Codveda Level 3 · Task 1)

Full-stack CRUD app: **React + Vite** → **REST API (Express)** → **MongoDB (Mongoose)**.
Dishes are the primary CRUD resource; categories have full CRUD too; customers place orders that are saved in MongoDB.

## Run it locally

Requirements: Node 18+ and MongoDB (local install, or a free MongoDB Atlas cluster).

```bash
# 1. install everything
npm run install:all

# 2. configure the backend
cp server/.env.example server/.env      # set MONGODB_URI, ADMIN_PASSWORD, and JWT_SECRET

# 3. load the starting menu (9 categories, 50 items) into MongoDB
npm run seed

# 4. start backend (http://localhost:5000) and, in a second terminal, the frontend (http://localhost:5173)
npm run server
npm run client
```

* Website: http://localhost:5173
* **Admin dashboard: http://localhost:5173/admin** — sign in with the `ADMIN_PASSWORD` from `server/.env`. Set a private value; there is no built-in password fallback. This is a simple shared password sent as an `x-admin-key` header so customers can't edit the menu.
* API: http://localhost:5000/api/health

Production-style: `npm run build`, then `npm run server` also serves `client/dist` at http://localhost:5000.
Reset the menu any time with `npm run seed -- --force` (orders are kept).

## No MongoDB installed? One command
```bash
npm run install:all
npm run server:local-db      # starts its own MongoDB, seeds the menu, starts the API
npm run client               # second terminal
```
First run downloads a MongoDB server binary (~100 MB, needs internet). Data persists in `server/.data`. In this mode you do not need `server/.env` or `npm run seed`.

## MongoDB connection
Local: `MONGODB_URI=mongodb://127.0.0.1:27017/sofra`.
Atlas: paste your `mongodb+srv://…` string into `server/.env`. Credentials only live in the backend `.env`.

## REST API
| Resource | Endpoints |
|---|---|
| User auth | `POST /api/auth/register`, `POST /api/auth/login` (returns a one-hour JWT), `GET /api/auth/me` (Bearer token required) |
| Admin | `POST /api/admin/login`, `GET /api/admin/verify`, `POST /api/uploads/dish-image` (multipart field `image`, JPG/PNG/WebP/AVIF ≤ 5 MB) |
| Categories | `GET/POST /api/categories`, `GET/PUT/DELETE /api/categories/:id` (delete refused with 409 while it still has dishes) |
| Dishes | `GET/POST /api/dishes` (`?category=slug&search=&featured=true`), `GET/PUT/DELETE /api/dishes/:id` |
| Orders | `POST /api/orders`, `GET /api/orders`, `PATCH /api/orders/:id/status`, `GET /api/orders/stats`, `GET /api/orders/lookup/:orderId` |
| Reservations | `GET /api/reservations/availability` and `POST /api/reservations` are public; `GET/PUT /api/reservation-settings`, `GET /api/reservations`, and `PATCH /api/reservations/:id/status` require the admin key |

**Who can do what:** everyone can register, log in, `GET` the menu and categories, place/look up an order, and request a table without creating an account. `GET /api/auth/me` requires a valid user JWT. Dish/category edits, uploads, order administration, reservation settings, reservation listing, and reservation status changes require the separate admin password and return **401** otherwise.

## Table reservations
Bookings remain unavailable until an administrator completes **/admin → Reservation Settings** with the real timezone, weekly opening hours, reservation duration, table count and capacities, and maximum party size. No manual booking times, fictional footer hours, or sample seating values are used: the API generates slots every 30 minutes from the saved opening time, and only returns times where the complete configured duration fits and a suitable table is available. Closing earlier than opening represents an overnight schedule; after-midnight times are listed on their local calendar date. Availability uses the saved restaurant timezone. Each booking is assigned one suitable table, and pending reservations hold that table until confirmed, rejected, or cancelled. Public booking is at `/reservations`; the admin queue and settings are under `/admin`.

User registration/login require `JWT_SECRET` in `server/.env` (and in Vercel project environment variables when deployed). Set a randomly generated value of at least 32 bytes; there is no built-in fallback. User passwords are stored as bcrypt hashes.

Order totals are computed on the server from database prices; unavailable dishes are rejected.

## Features
* Customer: animated hero, featured dishes, category showcase, story, searchable/filterable menu, dish details with ingredients and optional add-ons, cart drawer (persisted in localStorage, re-synced with live prices/availability), checkout with validation, order confirmation, optional account authentication, public table reservation requests, mascot with the three required Arabic messages, mobile menu, reduced-motion support.
* Admin: overview with live DB stats, dishes CRUD (price, category, description, ingredients, image, availability, featured, add-ons), categories CRUD, orders list with status updates (Pending / Preparing / Delivered), reservation schedule/table settings, and reservation queue with date/status filters and status updates.
* Limestone background is generated in CSS/SVG (procedural noise lighting), not a photo.

## Real food photography — how to add it
**No photographs are bundled.** The build environment could not reach Unsplash, Pexels or Pixabay and could not view images, so nothing was chosen blind. Until photos are added, dishes show a clean text card, the hero shows only the limestone + text, and the "Taste of Lebanon" strip shows only its text (tiles appear only for dishes that have a photo — no empty cards).

Add photos by dropping files into `client/public/assets/images/` with these names (jpg / jpeg / png / webp / avif):

| Folder | File names |
|---|---|
| `dishes/` | `<dish-slug>.jpg` — `hummus`, `moutabal`, `baba-ghanouj`, `tabbouleh`, `fattoush`, `warak-enab`, `labneh`, `kibbeh`, `cheese-rakakat`, `sambousek`, `batata-harra`, `grilled-halloumi`, `soujouk`, `shish-tawook`, `kafta`, `shish-kebab`, `mixed-grill`, `grilled-chicken`, `kibbeh-bil-sanieh`, `sayadieh`, `kafta-bil-sanieh`, `moghrabieh`, `fatteh`, `knefeh`, `baklava`, `maamoul`, `sfouf`, `meghli`, `jallab`, `ayran`, `lebanese-lemonade`, `tamarind`, `fresh-juice` |
| `categories/` | `cold-mezza`, `hot-mezza`, `lebanese-grill`, `traditional-dishes`, `desserts`, `drinks` |
| `site/` | `hero` (wide landscape table photo, right side is what shows), `story`, and optional transparent PNGs `rakwe`, `jarn`, `lantern`, `jug` (real heritage objects) and `cedar` (real cedar for the menu cover) |

Then:
```bash
npm run photos:scan                      # wires the files in
npm run photos:check                     # confirms each file really is an image (and warns on duplicates)
npm run seed -- --force --prefix server  # or: cd server && npm run seed -- --force
```
Dish photos can also be changed one at a time in **/admin → Dishes → Edit → Dish photo → Upload photo** (live preview). Record every source, photographer and licence in `PHOTO_CREDITS.md`.

## Menu cover, cedar and heritage objects (honest notes)
* The **menu cover** (emerald leather, gold foil, سُفْرَة, "OPEN MENU") opens like a hardcover book using CSS 3D transforms. It appears when visitors arrive via "Our Menu"; links straight to a category skip it. Reduced-motion users get a simple fade.
* The **cedar** on the cover is a procedurally drawn gold-foil *engraving*, not a photograph and not a 3D model. For a photoreal cedar, add a transparent `site/cedar.png`.
* The **mascot** and **heritage objects** (copper rakwe, jarn, lantern, jug) are shaded layered SVG, **not** photoreal or GLB/GLTF models — no licensed assets could be obtained here. Transparent photos of real objects in `site/` replace the drawn ones automatically.

## Testing status
UI flows (book entrance, menu cover, cart, checkout, mascot messages, admin CRUD, mobile) were exercised in a real browser against a temporary in-memory stand-in for the API, because MongoDB could not be installed in the build sandbox. `server/scripts/smoke-test.js` (`npm run test:api --prefix server`) runs 30+ checks against the real API + MongoDB; **run it on your machine** after seeding.


## Admin photo uploads
In **/admin → Dishes → New/Edit → Upload photo** the file is saved to `client/public/assets/images/dishes/upload-<name>-<id>.<ext>` and the dish stores that path. Files are checked by type, real image signature and size; an uploaded file is deleted again when the dish is deleted or its photo is replaced. Dishes with no photo show a card labelled **"Photo coming soon"** — no fake pictures are used.

## Menu & photos (from your ZIP)
Nine categories: Cold Mezza, Hot Mezza, Lebanese Grill, Main Courses, **Manakish**, Lebanese Desserts, Fresh Drinks, Coffee & Hot Drinks, **Shisha**. Only items that have a matching photo in your ZIP are on the menu (39 photographed dishes + 5 Manakish + 6 Shisha). **Manakish and Shisha each use ONE shared photo** (`assets/images/categories/manakish.jpg`, `shisha.jpg`; category layout = *Shared photo*), with every variety listed under it with its own Arabic name, price and Add button.

Photos live in `client/public/assets/images/dishes/<dish-slug>.jpg` and `categories/<category-slug>.jpg`. Photos that were not used (extra dishes not on your list, a duplicate, and a mixed-juice photo that needs your confirmation) are in the `Unidentified Images/` folder with a table explaining each.

**Prices are placeholders** (flagged `pricePlaceholder`; admin shows a yellow *placeholder* tag). Editing a price in /admin clears the flag. Run `npm run seed -- --force` once to load this menu.

Admin → Categories: add/rename/delete categories, Arabic name, upload/replace/remove the category photo, and choose *Photo per dish* or *Shared photo*.

## Extra tests
`npm run test:offline --prefix server` (no database needed) checks the admin guard, upload rules and model validation. `npm run test:reservations --prefix server` runs reservation settings, availability, conflict, guest-booking, and admin-protection tests against an isolated in-memory database.

## Mascot (waiter)
Exactly five approved Arabic messages, defined in `client/src/context/MascotContext.jsx`: opening the website (once per browser tab session), selecting a dish (opening its details), adding to cart, opening the cart, and a successful checkout (only after the server accepts the order). No other actions trigger the mascot.

## Entrance
The SOFRA book (`MenuCover.jsx`, mounted in `Layout.jsx`) is the single entrance: shown once per browser tab session, the customer clicks **Open**, the book opens, then the Home page appears. "Explore Our Menu" and the Our Menu link go straight to the menu with no book. The old green curtain animation was removed.

## Deploy everything on Vercel (website + API in one project)
1. Create a MongoDB database (Atlas) and allow network access from `0.0.0.0/0`.
2. Put the connection string in `server/.env` (`MONGODB_URI=...`) and run `npm run seed -- --force` inside `server/` once.
3. For this repository's single-project Vercel setup, set `MONGODB_URI` and `ADMIN_PASSWORD` in Vercel environment variables. If the React frontend is deployed separately from the API (for example, frontend on Vercel and backend on Render), set `VITE_API_URL` in Vercel to the backend origin (for example, `https://your-service.onrender.com`); the client adds `/api`. Also set `CLIENT_ORIGIN` on the backend to the exact frontend origin. Set the same private `ADMIN_PASSWORD` value on the backend that you enter in the admin login form. Never put it in a `VITE_` variable. For Render diagnostics, `GET /api/health` reports the deployed commit, service name, and whether the admin password is configured; failed login responses report only that configuration flag and the submitted password length.
4. From the project's top folder (the one containing `api/`, `client/`, `server/` and `vercel.json`) run `npx vercel --prod`.
Check `https://YOUR-SITE.vercel.app/api/health` → `"db":"connected"`.
Note: photo upload in the admin is switched off on Vercel (read-only disk); paste an https:// image link instead. The seeded photos work normally.
