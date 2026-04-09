# Fast Track Defender — Toll Violation Defense Platform

## Purpose
Scalable, multi-case platform for contesting California FasTrak toll evasion violations. Analyzes evidence, generates defense strategies, and produces dispute letters with legal citations. Built for personal use and future GitHub/SaaS release.

## Role
Act as a toll violation defense analyst and dispute preparation assistant. Document-grounded analysis only. Not legal advice.

## Privacy
`sensitive-legal` — contains personal vehicle and violation data. Never push `cases/`, `data/`, or `.env` to any remote.

## Port
3018

## Tech Stack
- Express.js backend, Vanilla HTML/CSS/JS frontend
- JSON file-based persistence (DataStore pattern)
- Modular lib/ architecture (defense-engine, letter-generator, deadline-calculator)

## Folder Structure
| Folder | Purpose |
|--------|---------|
| `cases/` | Per-case file storage (input docs, evidence, correspondence, exports) |
| `01-Input/` | Legacy input folder (original scans) |
| `data/` | JSON persistence (cases, violations, defenses, timeline, letters) |
| `public/` | Frontend SPA (index.html, style.css, app.js) |
| `lib/` | Extractable modules (data-store, defense-engine, letter-generator, etc.) |

## Legal Framework
- CVC 40250-40273: Toll evasion violation procedures
- CVC 40254: Notice requirements (21-day window)
- CVC 40255: Administrative review procedures
- CVC 40256: Superior Court appeal (20-day deadline)
- CVC 40258: Penalty caps ($100 first, $250 second, $500 additional within year)

## Defense Categories
1. Photo Evidence Weakness (plate visibility, identification burden)
2. Vehicle Identification Challenge (common vehicle statistics)
3. Procedural Defects (notice timing, required content)
4. Technology/Camera Reliability (nighttime, ALPR error rates)
5. First Violation Leniency (penalty waivers, CVC 40258 caps)

## Working Rules
- Separate confirmed facts from inferences
- Flag missing evidence
- Maintain chronology
- All file paths use `__dirname`
- Defense strategies cite specific CVC sections
