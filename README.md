# Fast Trak-Defender

**Toll violation defense platform for California FasTrak violations.**

Analyze evidence, build defense strategies with legal citations, and generate dispute letters — all from a single dashboard. Built for personal use and scalable to multi-user SaaS.

## Features

- **Multi-Case Management** — Track unlimited violations across multiple cases with per-case file storage
- **Defense Strategy Engine** — 5 built-in defense categories that auto-match to your violation's characteristics and score by strength
- **Dispute Letter Generator** — Contest letters (Section A), administrative review requests, and Superior Court appeal templates with CVC citations
- **Deadline Calculator** — Auto-computed deadlines from California Vehicle Code (CVC 40250-40273) with countdown alerts
- **Document Viewer** — Upload and view violation notices, photos, and evidence PDFs directly in the app
- **Legal Reference Library** — Searchable CVC sections with plain-English summaries and key deadlines
- **Timeline Tracker** — Chronological case history with auto-generated events

## Defense Categories

| Category | Strength | Description |
|----------|----------|-------------|
| Photo Evidence Weakness | Strong | Challenge plate visibility, identification burden, burden of proof |
| Vehicle Identification | Strong | Common vehicle statistics (e.g., Tesla Model 3 prevalence in CA) |
| Procedural Defects | Moderate | Notice timing violations (CVC 40254), missing required content |
| Camera/ALPR Reliability | Moderate | Nighttime conditions, system error rates, maintenance records |
| First Violation Leniency | Moderate | Penalty caps (CVC 40258), agency waiver policies |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ProfessorLessMuda/FastTrackDefender.git
cd FastTrackDefender

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3018** in your browser.

## Configuration

Create a `.env` file in the project root:

```
PORT=3018
```

## Project Structure

```
FastTrackDefender/
  server.js              Express API server
  lib/
    data-store.js        JSON file-based persistence
    defense-engine.js    Defense strategy analysis + auto-matching
    letter-generator.js  Dispute letter templates
    deadline-calculator.js  CVC deadline computation
    violation-parser.js  PDF text extraction + parsing
  public/
    index.html           SPA shell
    style.css            Aurora dark theme
    app.js               Frontend application (7 tabs)
  data/                  (auto-created, gitignored)
    cases.json           Case registry
    violations.json      Violation records
    defenses.json        Defense strategies
    letters.json         Generated letters
    timeline.json        Case events
    defense-library.json Reusable defense templates
  cases/                 (auto-created, gitignored)
    case-{uuid}/         Per-case file storage
```

## Legal Framework

Built around California Vehicle Code sections governing toll evasion:

- **CVC 40250** — Toll evasion defined; registered owner presumed liable
- **CVC 40254** — Notice requirements (21-day mailing window)
- **CVC 40255** — Contest and administrative review procedures (30-day contest window)
- **CVC 40256** — Superior Court appeal (20 days from admin review decision)
- **CVC 40258** — Penalty caps ($100 first, $250 second, $500 additional within one year)

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Platform status and counts |
| `GET /api/dashboard` | Aggregated dashboard data |
| `GET/POST /api/cases` | List or create cases |
| `GET/POST /api/violations` | List or create violations |
| `GET /api/defense-analysis/:id` | Run defense engine on a violation |
| `POST /api/defense-analysis/:id/apply` | Generate and save defense strategies |
| `POST /api/generate-letter` | Generate a dispute letter |
| `GET /api/legal-reference` | CVC sections as structured JSON |
| `GET /api/files` | File tree browser |
| `POST /api/upload` | Upload documents |

## Screenshots

The app features a dark aurora theme with animated gradient orbs, stat cards, defense strategy cards with strength ratings, and a full dispute letter preview with copy/print.

## Disclaimer

This tool is for informational and educational purposes only. It is not legal advice. Consult a licensed attorney for legal matters. The defense strategies and letter templates are starting points — review and customize them for your specific situation.

## License

MIT
