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

---

## Features

**Autonomous ingestion pipeline** — Parses your files, splits them into entries, and extracts named entities without any manual tagging.

**AI-written articles** — Gemini 1.5 Flash drafts and updates encyclopedic articles about the entities in your life, in proper Wikipedia style, with wikilinks cross-referencing related entries.

**Interactive knowledge graph** — A 2D visual map showing how the people, places, projects, and decisions in your life interconnect.

**Bi-directional wikilinks** — Click any `[[link]]` to navigate between articles. Every article also shows its backlinks — every other article that references it.

**Natural language queries** — Ask your wiki questions in plain English. "When did I last work with Rahul?" or "What led to the YC rejection?" — it answers from your own data.

**Total privacy** — No third-party tracking. All data is stored in your own HydraDB tenant instance.

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/debojyoti10cc/wikimind.git
cd wikimind
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```env
VITE_HYDRADB_API_KEY=<your key from app.hydradb.com>
VITE_HYDRADB_TENANT_ID=wiki
VITE_GEMINI_API_KEY=<your key from aistudio.google.com>
```

Get your HydraDB key at [app.hydradb.com](https://app.hydradb.com) and your Gemini key at [aistudio.google.com](https://aistudio.google.com).

### 3. Run

```bash
npm run dev
```

---

## How It Works

WikiMind processes your files in three phases:

**Phase 1 — Parse.** Format-specific parsers split your files into individual entries. Date headers like `2024-01-15` are detected automatically and used to sequence entries chronologically.

**Phase 2 — Extract.** Gemini scans each entry for named entities — people, places, projects, ideas, media — and categorizes them.

**Phase 3 — Synthesize.** For each entity, Gemini consolidates everything mentioned about it across all your entries into a single, coherent Wikipedia-style article. Articles are stored in HydraDB and cross-linked with wikilinks.

The knowledge graph and query interface are built on top of the resulting article store.

```
User uploads files
        │
        ▼
  Format parsers              .txt, .md, .json, .html, .csv
        │
        ▼
  Entity extraction           Gemini identifies people, places, projects, media
        │
        ▼
  Article synthesis           Gemini writes encyclopedic articles per entity
        │
        ▼
  HydraDB storage             Articles stored in your tenant, cross-linked
        │
        ▼
  Wiki UI                     Browse, navigate, graph, query
```

---

## Supported Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Plain text / Markdown | `.txt`, `.md` | Date headers (`2024-01-15`) auto-split into entries |
| Day One JSON | `.json` | Full export with `entries` array |
| Apple Notes HTML | `.html` | Standard HTML exports |
| iMessage CSV | `.csv` | Exported with tools like iExporter |

---

## Demo

A sample file is included at `sample_diary.txt`. It contains 9 dated diary entries and exercises the full pipeline end-to-end.

Entities extracted from the sample:

- **People** — Rahul, Arjun, Priya
- **Places** — IIT Bombay, Goa, Bangalore, Kolkata
- **Projects** — Zepto
- **Media** — *Atomic Habits*, *Zero to One*
- **Events** — YC rejection

Drop the file in the upload zone and watch the pipeline run.

---

## Architecture

```
src/
├── api/
│   ├── gemini.js           Gemini 1.5 Flash wrapper
│   └── hydradb.js          HydraDB REST wrapper
├── lib/
│   ├── pipeline.js         Absorption pipeline orchestrator
│   ├── parsers.js          Format-specific file parsers
│   ├── wikilinks.js        [[link]] resolver and backlink index
│   └── graph.js            Knowledge graph data builder
├── context/
│   └── WikiContext.jsx     Global state
├── pages/
│   ├── Home.jsx            Upload interface and pipeline progress
│   ├── ArticlePage.jsx     Single article view with backlinks
│   ├── GraphPage.jsx       Interactive knowledge graph
│   ├── DirectoryPage.jsx   Browse articles by category
│   └── QueryPage.jsx       Natural language query interface
└── components/
    ├── Sidebar.jsx
    ├── UploadZone.jsx
    ├── ProgressLog.jsx
    ├── ArticleViewer.jsx
    ├── RelatedPanel.jsx
    └── KnowledgeGraph.jsx
```

---

## Inspired By

- [Andrej Karpathy](https://karpathy.ai) — the pattern of using an LLM to incrementally build and maintain a persistent personal wiki
- [Farzapedia](https://twitter.com/farzaa) — using 2,500 diary entries to generate a personal Wikipedia
- [WikiThon](https://hydradb.com) — the hackathon that prompted this project, powered by HydraDB

---

## License

MIT. See [LICENSE](./LICENSE) for details.

---

*WikiMind — WikiThon Hackathon, May 2026*
