# 🔬 LabValues Helper

> Instantly see normal reference ranges for common lab values while reading medical content, with conventional/SI unit switching built in.

LabValues Helper is a lightweight Chrome extension for medical students, residents, and clinicians. It detects lab names on question banks and articles, highlights them on-page, and shows reference ranges in a hover tooltip or searchable reference views.

---

## What's new in v1.1

- **Tabbed popup UI** with **Page**, **Search**, and **Settings** modes
- **Unit system toggle** for **Conventional (US)** and **SI (International)** ranges
- **Settings sync with the content script** for:
  - auto-highlighting on pages
  - tooltip display on hover
  - active unit system
- **Reference page unit toggle** for browsing the full lab database in either system
- **Expanded lab data schema** with dual-unit structured ranges for every entry

---

## ✨ Features

- **📄 Page mode** — see all lab values detected on the active page
- **🔍 Search mode** — quickly search labs by name, ID, or abbreviation
- **⚙️ Settings mode** — switch unit systems and control highlighting/tooltips
- **💡 Auto-detection** — scans page text for CBC, BMP/CMP, thyroid, lipid, coagulation, ABG, diabetes, iron, cardiac, inflammatory, vitamin, pancreatic, and urinalysis labs
- **🖱️ Hover tooltip** — shows reference ranges and notes for highlighted terms
- **📋 Full reference list** — opens a searchable, categorized reference page
- **📵 Fully offline** — all data is bundled locally; no runtime network calls
- **🚫 No trackers** — zero analytics, zero telemetry

---

## 📖 How to use

### Popup modes

- **Page**: shows lab values detected on the current tab and lets you rescan the page
- **Search**: search any bundled lab directly from the popup
- **Settings**: choose **Conventional** or **SI** units, toggle page highlighting, and toggle hover tooltips

### On webpages

1. Open a medical article, question bank, or teaching page.
2. If **Auto-highlight on pages** is enabled, recognized lab terms are underlined.
3. Hover highlighted terms to see ranges if **Show tooltips on hover** is enabled.
4. Open the popup to review detected labs, search manually, or change settings.

### Full reference page

Click **View full reference list** from the popup to open the searchable reference table. Use the **Unit System** toggle at the top to switch between conventional and SI ranges.

---

## 🚀 Installation

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder containing `manifest.json`.
6. Pin **LabValues Helper** to the toolbar.

---

## Lab data schema

Each lab entry now stores both conventional and SI ranges:

```json
{
  "id": "hemoglobin",
  "name": "Hemoglobin",
  "category": "CBC",
  "aliases": ["Hb", "Hgb", "haemoglobin"],
  "ranges": {
    "conventional": [
      { "population": "Adult male", "low": 13.5, "high": 17.5, "unit": "g/dL" }
    ],
    "si": [
      { "population": "Adult male", "low": 135, "high": 175, "unit": "g/L" }
    ]
  },
  "conversionFactor": 10,
  "conversionNote": "g/dL × 10 = g/L",
  "notes": "Reference ranges may vary by lab."
}
```

Notes:
- `ranges.conventional` and `ranges.si` are both required
- `low` or `high` may be `null` for open-ended thresholds
- some entries use `conversionFactor: null` when conversion depends on row type or formula (for example HbA1c or differential counts)

---

## Project structure

```text
manifest.json               Chrome Extension Manifest V3
background.js               Background service worker
content/
  content.js                DOM scanner, highlighting, tooltip logic
  content.css               Highlight + tooltip styles
popup/
  popup.html                Tabbed popup UI
  popup.css                 Popup styles
  popup.js                  Popup logic
reference/
  reference.html            Full reference page
  reference.css             Reference page styles
  reference.js              Reference page rendering/search logic
data/
  lab-values.json           Dual-unit lab values database
icons/
  icon16.png
  icon48.png
  icon128.png
README.md
LICENSE
```

---

## ⚠️ Disclaimer

For educational purposes only. This extension is not a substitute for clinical judgment. Reference ranges vary by laboratory, assay method, population, and context. Always verify with your institution's values.

## 📄 License

MIT License — see [LICENSE](LICENSE).
