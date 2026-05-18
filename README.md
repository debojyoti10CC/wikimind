# WikiMind - Feed It Your Life. Get Your Wikipedia.

<div align="center">

![WikiMind Logo](https://img.shields.io/badge/WikiMind-Personal_AI_Wikipedia-blue)

[![React](https://img.shields.io/badge/React-19.2.6-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0.12-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Gemini](https://img.shields.io/badge/LLM-Gemini_1.5_Flash-purple?logo=googlegemini)](https://ai.google.dev/)
[![HydraDB](https://img.shields.io/badge/Database-HydraDB-orange)](https://hydradb.com)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

[Live Demo](#) • 
[Quick Start](#-installation--quick-start) • 
[Architecture](#-architecture) • 
[Supported Formats](#-supported-formats) • 
[Pipeline Dataflow](#-absorption-pipeline)

<p align="center">
<img width="1920" height="925" alt="image" src="https://github.com/user-attachments/assets/224c6fec-e08b-4d3d-bf10-597deed00d08" />

</p>

Drop your diary exports, Apple Notes, iMessages, or any personal text files. **WikiMind** runs an autonomous AI ingestion pipeline to extract named entities (people, places, projects, ideas) from your life, cross-references relationships, and generates a structured, personal Wikipedia-style knowledge base stored entirely in **YOUR** control.

**Your data. Your wiki. Your control.**

</div>

<div align="left">

##  Features

- **Autonomous Extraction Pipeline** – Automatically parses diary entries, extracts core entities, and structural links.
- **AI-Powered Synthesizer** – Leverages Gemini 1.5 Flash to automatically draft and update encyclopedic articles about your own life.
- **Interactive Knowledge Graph** – Visualizes how people, projects, places, and life decisions interconnect dynamically in 2D space.
- **Bi-directional Wikilinks** – Fully navigate your life using native text `[[wikilinks]]` with auto-generated contextual backlink panels.
- **Natural Language Querying** – Ask your wiki complex questions about your past, your friends, or historical choices using conversational prompts.
- **Total Privacy & Ownership** – Zero third-party data tracking. Everything sits securely inside your own HydraDB tenant instance.

##  Installation & Quick Start

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone [https://github.com/debojyoti10cc/wikimind.git](https://github.com/debojyoti10cc/wikimind.git)
cd wikimind

# Install required node modules
npm install
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
# wikimind
