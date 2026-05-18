# WikiMind Personal

> Feed it your life. Get your Wikipedia.

Drop your diary exports, Apple Notes, or any personal text files. WikiMind builds a personal Wikipedia about your life — your people, projects, ideas, and decisions — stored in YOUR HydraDB tenant.

**Your data. Your wiki. Your control.**

---

## Setup

1. Clone this repo
2. Copy `.env.example` to `.env`
3. Fill in your credentials:
   ```
   VITE_HYDRADB_API_KEY=<your key from app.hydradb.com>
   VITE_HYDRADB_TENANT_ID=wiki
   VITE_GEMINI_API_KEY=<your key from aistudio.google.com>
   ```
4. `npm install`
5. `npm run dev`

---

## How it works

1. **Upload** your personal data — diary exports, notes, iMessages, any text
2. **Absorption pipeline** parses entries, extracts named entities (people, places, projects, ideas), and calls Gemini to write Wikipedia-style articles
3. **Articles** are stored in your HydraDB tenant and rendered with full wikilink navigation
4. **Knowledge graph** shows how everything in your life connects
5. **Ask your wiki** — query your own life with natural language

---

## Supported formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Plain text / Markdown | `.txt`, `.md` | Date headers (`2024-01-15`) auto-split entries |
| Day One JSON | `.json` | Full export with `entries` array |
| Apple Notes HTML | `.html` | Exported HTML files |
| iMessage CSV | `.csv` | Exported with tools like iExporter |

---

## Demo

Use the included `sample_diary.txt` to test the full pipeline. It contains 9 dated entries mentioning:
- **People**: Rahul, Arjun, Priya
- **Projects**: Zepto
- **Places**: IIT Bombay, Goa, Bangalore, Kolkata
- **Media**: Atomic Habits, Zero to One
- **Events**: YC rejection

---

## Architecture

```
src/
├── api/
│   ├── gemini.js        ← Gemini 1.5 Flash wrapper
│   └── hydradb.js       ← HydraDB REST wrapper
├── lib/
│   ├── pipeline.js      ← Absorption orchestrator
│   ├── parsers.js       ← Format parsers
│   ├── wikilinks.js     ← [[link]] resolver + backlinks
│   └── graph.js         ← Graph data builder
├── context/
│   └── WikiContext.jsx  ← Global state
├── pages/
│   ├── Home.jsx         ← Upload + progress
│   ├── ArticlePage.jsx  ← Single article view
│   ├── GraphPage.jsx    ← Knowledge graph
│   ├── DirectoryPage.jsx← Browse by category
│   └── QueryPage.jsx    ← Ask your wiki
└── components/
    ├── Sidebar.jsx
    ├── UploadZone.jsx
    ├── ProgressLog.jsx
    ├── ArticleViewer.jsx
    ├── RelatedPanel.jsx
    └── KnowledgeGraph.jsx
```

---

## Inspired by

- [Andrej Karpathy's LLM-Wiki pattern](https://karpathy.ai) — "the LLM incrementally builds and maintains a persistent wiki"
- [Farzapedia](https://twitter.com/farzaa) — "I had an LLM take 2,500 diary entries to create a personal Wikipedia"
- [WikiThon hackathon](https://hydradb.com) powered by HydraDB

---

*PRD v2.0 — WikiThon Hackathon — May 2026*
