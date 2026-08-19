# 🃏 Card Collection Tracker

A modern, responsive card collection tracker built with **React**, **TypeScript**, **Tailwind CSS**, and **Vite**. Connects to a Google Sheets backend via Vercel serverless functions.

![Card Tracker](https://img.shields.io/badge/React-18-blue) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

## ✨ Features

- **Live Google Sheets Sync** — Cards are read from and saved to your Google Sheet
- **Collection Browser** — Sidebar with progress bars per collection
- **Smart Filters** — Search, filter by status (Got/Need/Collecting), sort, and filter by variant
- **Grid & List Views** — Toggle between visual card grid and compact list
- **Color-Coded Variants** — Each variant type gets unique styling (Gold, Netbuster, Voltage, etc.)
- **Export to Excel** — Download your collection as a `.xlsx` file
- **Optimistic Updates** — Instant UI feedback when toggling cards
- **Fully Responsive** — Works on mobile, tablet, and desktop
- **Dark Theme** — Modern dark UI with glassmorphism effects

## 📁 Project Structure

```
card-tracker/
├── api/                    ← YOUR EXISTING API (keep this!)
│   ├── read.js             ← GET endpoint for Google Sheets
│   └── update.js           ← POST endpoint for Google Sheets
├── src/
│   ├── components/
│   │   ├── CardItem.tsx         — Individual card (grid + list)
│   │   ├── CollectionSidebar.tsx — Collection browser with progress
│   │   ├── ExportModal.tsx      — Excel export dialog
│   │   ├── FilterBar.tsx        — Search, filter, sort controls
│   │   ├── Header.tsx           — Top bar with stats + actions
│   │   ├── LoadingSkeleton.tsx  — Loading placeholder
│   │   └── SettingsModal.tsx    — Backend info dialog
│   ├── hooks/
│   │   └── useCards.ts          — API calls + data logic
│   ├── App.tsx                  — Main app
│   ├── index.css                — Global styles
│   ├── main.tsx                 — Entry point
│   └── types.ts                 — TypeScript types
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 How to Deploy to Your GitHub + Vercel

### Step 1: Download this project

Download the ZIP from the assistant, or copy the files manually.

### Step 2: Copy your `api/` folder

Your existing `api/` folder (with `read.js` and `update.js`) is critical. Copy it into the root of this project:

```bash
# From your old repo, copy the api folder into this new project
cp -r /path/to/your/old-repo/api ./api/
```

### Step 3: Install dependencies

```bash
npm install
```

### Step 4: Test locally

```bash
npm run dev
```

> Note: The API calls (`/api/read`, `/api/update`) won't work locally unless you set up Vercel CLI. The UI will show an error state, which is expected.

To test with Vercel CLI locally:
```bash
npm install -g vercel
vercel dev
```

### Step 5: Push to GitHub

**Option A — Replace your existing repo:**
```bash
# In your existing card-tracker repo
# Delete old frontend files (index.html, style.css, app.js, etc.)
# Keep the api/ folder!
# Copy all new files in
git add .
git commit -m "Complete UI rebuild with React + Tailwind"
git push origin main
```

**Option B — Create a new repo:**
```bash
git init
git add .
git commit -m "Initial commit: Card Collection Tracker"
git remote add origin https://github.com/YOUR_USERNAME/card-tracker.git
git push -u origin main
```

Then connect the new repo to Vercel.

### Step 6: Vercel Environment Variables

Make sure these are set in your Vercel project settings:

| Variable | Description |
|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Your Google service account email |
| `GOOGLE_PRIVATE_KEY` | Your Google service account private key |
| `SHEET_ID` | Your Google Sheets document ID |

### Step 7: Deploy

Once pushed to GitHub, Vercel will **automatically detect Vite**, build the project, and deploy it. Your API routes in `api/` will continue to work as serverless functions.

---

## 🔧 Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool (auto-detected by Vercel) |
| Tailwind CSS 4 | Styling |
| Framer Motion | Animations |
| Lucide React | Icons |
| XLSX | Excel export |
| Google Sheets API | Backend data storage |
| Vercel | Hosting + serverless functions |

---

## 📝 API Reference

### `GET /api/read`
Returns all cards from Google Sheets.
```json
{
  "success": true,
  "rows": [
    ["Card ID", "Year", "Card Set", "Card No.", "Player Name", "Card Description", "Variant", "Collecting", "Got", "Image URL"],
    ["18558", "2026-27", "Topps Flagship Premier League", "119", "James Tarkowski", "Base Set - Common", "Base", "TRUE", "FALSE", ""]
  ]
}
```

### `POST /api/update`
Toggles the "Got" status of a card.
```json
{ "id": "18558", "got": true }
```

---

## 📄 License

MIT
