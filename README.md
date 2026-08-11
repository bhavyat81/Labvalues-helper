# 🔬 LabValues Helper

> **Instantly see normal reference ranges for lab values (CBC, BMP, glucose, HbA1c & more) on any medical question or article page.**

A lightweight Chrome extension built for **medical students, residents, and healthcare professionals**. While solving question banks (UWorld, AMBOSS, Kaplan, Marrow, Prepladder) or reading clinical articles, it automatically detects lab test names on the page and shows their normal reference ranges instantly.

---

## ✨ Features

- **🔍 Auto-detection** — Scans visible page text for 70+ lab test names and abbreviations (CBC, BMP, glucose, HbA1c, troponin, TSH, etc.)
- **💡 Subtle highlighting** — Detected terms get a soft blue dotted underline that doesn't break page layout
- **🖱️ Hover tooltip** — Shows full name, normal reference ranges (adult/pediatric), SI units, and clinical notes
- **⚡ SPA support** — MutationObserver ensures highlighting works on dynamically-loaded question bank pages
- **🔎 Search bar** — Popup lets you search any lab value by name or abbreviation instantly
- **📋 Page lab list** — See all lab values detected on the current page in the popup
- **🔘 Toggle** — Enable/disable auto-highlighting per-session (persisted via storage)
- **📄 Full reference table** — Opens a complete searchable, categorized reference page in a new tab
- **📵 Fully offline** — No network calls at runtime; all data bundled locally
- **🚫 No trackers** — Zero analytics, zero telemetry

## 📸 Screenshots

| Popup | Reference Page |
|-------|----------------|
| *(Popup with search and detected labs)* | *(Full categorized reference table)* |

---

## 🗂️ Lab Value Categories

| Category | Examples |
|----------|----------|
| **CBC** | Hemoglobin, Hematocrit, WBC (with differential), Platelets, MCV, MCH, MCHC, RDW |
| **BMP/CMP** | Sodium, Potassium, Chloride, BUN, Creatinine, Glucose, Calcium, Magnesium |
| **LFT** | AST, ALT, ALP, GGT, Total/Direct/Indirect Bilirubin |
| **Lipid Panel** | Total Cholesterol, LDL, HDL, Triglycerides |
| **Thyroid** | TSH, Free T4, Free T3, Total T4, Total T3 |
| **Coagulation** | PT, INR, aPTT, Bleeding Time, D-dimer, Fibrinogen |
| **ABG** | pH, PaO2, PaCO2, SaO2, Anion Gap |
| **Diabetes** | HbA1c, Fasting Glucose, OGTT |
| **Iron Studies** | Serum Iron, Ferritin, TIBC, Transferrin Saturation |
| **Cardiac Markers** | Troponin I/T, CK-MB, BNP, NT-proBNP |
| **Inflammatory** | CRP, ESR |
| **Others** | Uric Acid, LDH, Amylase, Lipase, B12, Folate, Vitamin D |
| **Urinalysis** | Urine Protein, Urine Specific Gravity |

---

## 🚀 Installation

### Load as Unpacked Extension (Developer Mode)

1. **Download / clone this repository:**
   ```bash
   git clone https://github.com/bhavyat81/Labvalues-helper.git
   ```

2. **Open Chrome** and navigate to `chrome://extensions`

3. **Enable Developer Mode** (toggle in top-right corner)

4. Click **"Load unpacked"**

5. **Select the repository folder** (`Labvalues-helper/`) — the one containing `manifest.json`

6. The extension icon (🔬) will appear in your toolbar. **Pin it** for easy access.

> **Note:** The included PNG icons are simple solid-color placeholders. For a polished icon, replace `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png` with your custom icons (or convert `icons/icon.svg` using any SVG→PNG tool).

---

## 📖 How to Use

### While Solving Question Banks
1. Open UWorld, AMBOSS, Kaplan, Marrow, or any QBank
2. Lab terms on the page are **automatically highlighted** with a dotted blue underline
3. **Hover** over any highlighted term to see its reference range in a tooltip
4. Click the **toolbar icon** (🔬) to:
   - See all lab values detected on the current page
   - **Search** for any lab value manually
   - Open the **Full Reference Table** in a new tab

### While Reading Clinical Articles
Same as above — works on any webpage including PubMed, UpToDate, Wikipedia medical articles, etc.

### Toggle Highlighting
Click the toolbar icon and use the **toggle switch** in the top-right of the popup to enable/disable auto-highlighting on the current session. This is persisted across sessions via `chrome.storage.local`.

---

## ➕ Adding New Lab Values

Edit `data/lab-values.json` and add a new entry following this schema:

```json
{
  "id": "your_lab_id",
  "name": "Full Lab Name",
  "category": "Category Name",
  "aliases": ["Abbreviation1", "Abbreviation2", "common name"],
  "ranges": [
    { "population": "Adult", "low": 0.0, "high": 0.0, "unit": "unit" }
  ],
  "siRange": "SI range as string",
  "notes": "Clinical notes / interpretation tips."
}
```

**Tips:**
- `id` must be unique (use snake_case)
- `aliases` are matched case-insensitively with word boundaries — include all common abbreviations
- Sort longer aliases first in the array for best matching
- `low` or `high` can be `null` (e.g., for thresholds like "≥ 200 = diabetic")
- Reload the extension after editing (`chrome://extensions` → Reload)

---

## 🗃️ File Structure

```
manifest.json               Chrome Extension Manifest V3
background.js               Service worker (messaging relay)
content/
  content.js                DOM scanner, highlighter, tooltip logic
  content.css               Highlight + tooltip styles
popup/
  popup.html                Popup UI
  popup.css                 Popup styles
  popup.js                  Popup logic (search, page labs, toggle)
reference/
  reference.html            Full reference page
  reference.css             Reference page styles
  reference.js              Reference page logic (render, search, filter)
data/
  lab-values.json           Lab values database (70+ entries)
icons/
  icon.svg                  Source SVG icon
  icon16.png                16×16 PNG icon
  icon48.png                48×48 PNG icon
  icon128.png               128×128 PNG icon
README.md                   This file
LICENSE                     MIT License
```

---

## ⚠️ Disclaimer

> **For educational purposes only.** This extension is not a substitute for clinical judgment. Reference ranges provided are based on widely-accepted USMLE/standard textbook values (Harrison's Principles of Internal Medicine, First Aid for the USMLE). Actual reference ranges may vary by laboratory, patient population, assay method, and clinical context. Always verify with your institution's laboratory reference values.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Pull requests welcome! To add new lab values, edit `data/lab-values.json`. For bug reports or feature requests, open an issue.

---

*Built with ❤️ for medical students and healthcare professionals.*