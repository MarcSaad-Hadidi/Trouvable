# Trouvable Admin — Visual Redesign Direction v2 (Official)

> [!NOTE]
> v2 integrates all 13 corrections from the operator review of v1. This is the **approved direction** for implementation.

## Product Identity

**Trouvable** is a premium AI Visibility OS for local businesses.  
The admin is an **internal operator workspace** — not a client portal, not a generic SaaS dashboard.  
The operator makes decisions about SEO, GEO, and Agent readiness for a portfolio of mandates.

---

## 1. Visual Language

### Black-First Canvas Rule

> [!IMPORTANT]
> The UI must read as **black / graphite at first glance** — not navy, not blue, not purple. Accent colors must never dominate the canvas. The foundation is true black, obsidian, graphite, charcoal. Accents are rare, controlled, and professional.

### Color Foundation

| Token | Hex | Role |
|---|---|---|
| `--t-black` | `#06060a` | True black canvas |
| `--t-obsidian` | `#0c0c12` | Rail, elevated panels |
| `--t-graphite` | `#131319` | Card surfaces |
| `--t-slate` | `#1a1a24` | Hover states, table rows |
| `--t-ash` | `#24242e` | Dividers, subtle borders |
| `--t-mist` | `rgba(255,255,255,0.06)` | Ghost borders |

### Accent Palette — Restrained, Semantic

| Name | Hex | Use |
|---|---|---|
| Trouvable Violet | `#7c6aef` | Brand identity, primary CTA, active indicators |
| Trouvable Indigo | `#6366f1` | Secondary brand, links |
| Steel Blue | `#6b9cc5` | SEO world identity, info states |
| Muted Orange | `#d4874a` | Agent world identity |
| Agent Indigo | `#818cf8` | Agent secondary accent |
| Stable Green | `#4ade80` (70% sat) | Success, OK, validated — **semantic only** |
| Warning Amber | `#d4a34a` | Attention states, aging data |
| Critical Coral | `#e06060` | Errors, critical mandates |

### Service World Accents (final)

| World | Primary | Secondary | Never |
|---|---|---|---|
| SEO / Google | Steel Blue `#6b9cc5` | Green (for SEO health) | — |
| GEO / IA | Trouvable Violet `#7c6aef` | Cyan / cool blue | — |
| Agent | Muted Orange `#d4874a` | Agent Indigo `#818cf8` | ~~Green~~ (reserved for semantic) |

### Typography (premium desktop scale)

| Role | Size | Font | Tracking |
|---|---|---|---|
| Eyebrow / micro label | 10–11px | Inter | +0.12em |
| Compact label | 12px | Inter | +0.02em |
| Body operational | 13–14px | Inter | normal |
| Section title | 15–16px | Plus Jakarta Sans | -0.01em |
| Page title | 28–36px | Plus Jakarta Sans | -0.04em |
| Hero number | 40–56px | Plus Jakarta Sans | -0.04em |
| Monospace values | 12px | JetBrains Mono | normal |

> Page titles like "Portefeuille" or "GEO Situation" must have a **strong premium presence** — no tiny labels at 20px.

### Surface System (3 tiers)

1. **Canvas** (`--t-black`): The background. Never a "card."
2. **Panel** (`--t-graphite` + `border-white/[0.07]`): Primary content containers. 14px radius. Subtle inset highlight top edge.
3. **Elevated** (`--t-obsidian` + `border-white/[0.09]` + deep shadow): Drawers, modals, popovers. 16px radius. Glassmorphism backdrop-blur on overlays only.

### Iconography
- 16×16 stroke icons, 1.5px weight, monochrome white/opacity
- No filled icons except active states
- Service-specific accent **dot** (not icon color) to indicate context

---

## 2. Redesigned Shell: Rail + Tray + Stage

### Current Problems
- Sidebar lists 40+ items in a flat scroll — cognitive overload
- TopBar is passive (shows label, clock) — wastes prime real estate
- MissionRibbon repeats client name without actionable context
- No visual separation between "portfolio mode" and "client mode"

### Architecture

```
┌──────────────────────────────────────────────────┐
│ RAIL (56px)  │  STAGE (fluid)                    │
│ ┌──┐         │                                   │
│ │◆ │ Logo    │  ┌─ CommandStrip ──────────────┐   │
│ │──│         │  │ breadcrumb · client · period │   │
│ │📊│ Home    │  └────────────────────────────────┘ │
│ │🔍│ SEO     │                                   │
│ │🤖│ GEO     │  ┌─ TRAY (220px) ─┐              │
│ │⚡│ Agent   │  │ Client context  │  Page content │
│ │──│         │  │ nav + world nav │  (geo-content │
│ │📁│ Dossier │  │ grouped by      │   scroll      │
│ │──│         │  │ intent          │   viewport)   │
│ │⚙ │ Settings│  │                 │              │
│ │👤│ Profile │  └─────────────────┘              │
│ └──┘         │                                   │
└──────────────┴───────────────────────────────────┘
```

#### A. The Rail (56px, fixed left)

- Collapsed icon-only vertical bar
- **7 destinations**: Home, SEO, GEO, Agent, Dossier, Settings, Profile
- Active world shows accent-colored pill behind icon
- Trouvable logo mark at top (no text)
- User avatar at bottom (click → popover with sign-out)
- **Tooltips on hover** (mandatory)
- **Labels accessible via keyboard focus**
- **On large desktop (≥1600px)**: option to show labels beside icons

#### B. The Tray (220px, contextual)

- Appears when a **client is selected**
- Shows navigation for the **current world**, grouped by intent
- **Client selector** at top of tray: pill with name + health dot + lifecycle badge
- Top section always shows client-level links:
  - Vue d'ensemble
  - Dossier
  - Audit / Evidence
  - Settings / Portal
- Below: world-specific items grouped by intent
- Collapsible on mobile (slide-over)
- **Permanently visible on desktop** when client is selected

#### C. The Stage (fluid)

- **CommandStrip** replaces TopBar + MissionRibbon:
  - Left: breadcrumb trail (World > Section > Page)
  - Center: client name + freshness dot (when in client context)
  - Right: period selector (7j/30j/90j), refresh button, ⌘K command palette trigger
- Below CommandStrip: `geo-content` scroll viewport (scroll model unchanged)
- ⌘K is an **accelerator**, not a replacement for navigation

---

## 3. Navigation Architecture

### Portfolio (no tray — full stage)
Home dashboard and client list use full-width stage. No tray needed.

### Client Context (always visible in tray top section)

| Item | Notes |
|---|---|
| Vue d'ensemble | Client landing page |
| Dossier | Fiche mandat |
| Journal | Activity timeline |
| Sources | Connectors |
| Audit / Evidence | Lab + comparisons |
| Portal | Client report |
| Paramètres | Mandate settings |

### SEO World Tray — accent: Steel Blue `#6b9cc5`

| Group | Items |
|---|---|
| **Observe** | Vue SEO, Visibilité organique |
| **Analyze** | Santé SEO, Inspecteur on-page, Matrice contenu, Cannibalisation |
| **Act** | Opportunités SEO, Prompts correction, **Préparation locale** |

> SEO Local / Préparation locale **stays in SEO**. Local is a Google/SEO pillar: GBP, city pages, local pack, organic local queries.

### GEO World Tray — accent: Trouvable Violet `#7c6aef`

| Group | Items |
|---|---|
| **Observe** | GEO Situation, Fiabilité modèles, Surveillance |
| **Analyze** | Crawlers IA, Schema/entité, Cohérence marque, **Sources & Citations**, Intelligence sociale |
| **Act** | Préparation GEO, Alertes GEO, Actions GEO, Comparaison fournisseurs |
| **Configure** | Prompts, Exécutions, llms.txt |

> Sources & Citations remains a **standalone signature page**. Intelligence sociale is a secondary/advanced page, not fused.

### Agent World Tray — accent: Muted Orange `#d4874a`

| Group | Items |
|---|---|
| **Observe** | Vue Agent, Visibilité Agent |
| **Analyze** | Préparation Agent, Actionnabilité, Protocoles, Concurrents Agent |
| **Act** | Correctifs Agent |

---

## 4. Page Inventory

### Portfolio Level

| Current | Decision | New Name |
|---|---|---|
| Centre de commande | **KEEP + REDESIGN** | Cockpit |
| Portefeuille (client list) | **KEEP + REDESIGN** | Portefeuille |
| Nouveau mandat | **KEEP** | Nouveau mandat |

### Client Dossier

| Current | Decision | New Name |
|---|---|---|
| Dossier overview | **KEEP + REDESIGN** | Fiche mandat |
| Laboratoire audit | **KEEP** | Laboratoire audit |
| Comparaison audits | **FUSE** into Lab | Tab inside audit lab |
| Activité | **KEEP** | Journal |
| Connecteurs | **KEEP** | Sources |

### SEO World (9 pages — unchanged)

| Page | Decision |
|---|---|
| Vue SEO | **REDESIGN** (Cockpit archetype) |
| Visibilité organique | **KEEP** |
| Santé SEO | **KEEP** |
| Inspecteur on-page | **KEEP** (Inspector archetype) |
| Matrice contenu | **KEEP** |
| Cannibalisation | **KEEP** |
| Opportunités SEO | **REDESIGN** (Action Queue archetype) |
| Prompts correction | **KEEP** |
| Préparation locale | **KEEP in SEO** |

### GEO World (15 pages — kept separate)

| Page | Decision |
|---|---|
| GEO Situation | **REDESIGN** (Cockpit archetype) |
| Crawlers IA | **KEEP** |
| Schema et entité | **KEEP** |
| Préparation GEO | **KEEP** |
| Cohérence marque | **KEEP** |
| Alertes GEO | **KEEP** |
| Exécutions | **KEEP** |
| Prompts | **KEEP** (Workbench archetype) |
| Comparaison fournisseurs | **KEEP** |
| **Sources & Citations** | **KEEP as standalone** (signature screen) |
| Intelligence sociale | **KEEP as separate advanced page** |
| Actions GEO | **REDESIGN** (Action Queue archetype) |
| llms.txt | **KEEP** |
| Fiabilité modèles | **KEEP** |
| Surveillance | **KEEP** |

### Agent World (7 pages — unchanged)

All pages kept as-is.

### New Pages — Priority (Phase 1)

| Page | World | Archetype | Purpose |
|---|---|---|---|
| `/geo/answers` | GEO | Inspector | Raw Answer Inspector — inspect actual LLM responses |
| `/geo/sources` (enhanced) | GEO | Registry | Source Influence Matrix — which sources drive citations |
| `/agent/workflows` | Agent | Workbench | Agent Workflow Canvas — crawler interaction flows |
| `/agent/logs` | Agent | Registry | Observability Logs — real-time crawler activity |

### New Pages — Phase 2 (deferred)

| Page | World | Purpose |
|---|---|---|
| Comparaison mandats | Portfolio | Side-by-side client health |
| Rapport opérateur | Portfolio | Weekly operator summary export |

---

## 5. Page Composition Rules

### ❌ Banned Patterns
1. **No "4 KPI cards + line chart + data table" template.** Every page must have a unique composition.
2. **No card grids with identical structure.** If 3+ cards look the same, use a list or strip instead.
3. **No chartjunk.** Charts must answer a specific operator question.
4. **No rainbow colors.** Maximum 2 accent colors per page.
5. **No ornamental gradients.** Gradients only for wash overlays on hero panels.
6. **No fake live indicators** unless data actually streams or was refreshed < 5 min ago.
7. **No decorative charts.** Every chart must support a decision.
8. **No sparkline / gauge / graph** unless it answers a specific operator question.

### ✅ Required Page Archetypes

| Archetype | Structure | Use When |
|---|---|---|
| **Cockpit** | Hero metric + narrative verdict + action queue | Overview pages (Home, SEO Situation, GEO Situation, Agent Situation) |
| **Workbench** | Left filter rail + center data + right detail | Pages with select-and-inspect flow (Prompts, Exécutions) |
| **Inspector** | Master list → inline expansion | Detail inspection (On-page, Schema, Raw Answers) |
| **Registry** | Dense table + column filters + bulk actions | List-heavy pages (Portefeuille, Sources, Logs) |
| **Dossier** | Identity strip + timeline + connector bus | Client-level overview (Fiche mandat) |
| **Action Queue** | Priority-sorted list + inline fix + evidence drawer | Remediation pages (Opportunités, Correctifs) |

### Archetype Declaration Rule

> [!IMPORTANT]
> Before coding any page, declare:
> 1. Which archetype
> 2. Why it fits
> 3. Which components fill each slot
> 4. What real data feeds each block
> 5. What operator action the page supports
>
> No page may use a "custom dashboard" layout without archetype.

---

## 6. Evidence-First Principle

> [!IMPORTANT]
> **Non-negotiable.** Every important metric, alert, recommendation, or action must be traceable to evidence: run, audit, source, timestamp, connector, or raw output.

Every page must answer four questions:

| # | Question | Implementation |
|---|---|---|
| 1 | What is happening? | Hero metric or verdict |
| 2 | Why does it matter? | Narrative explanation |
| 3 | What should the operator do? | Action CTA |
| 4 | What evidence supports it? | Link to proof (run, audit, source, raw output) |

The dashboard must **never become decorative**. If a metric has no evidence, show "Preuve insuffisante" — not a fake number.

---

## 7. Component Patterns per World

### Tables / Lists

| Property | SEO | GEO | Agent |
|---|---|---|---|
| Row height | 44px compact | 52px with avatar | 48px standard |
| Accent stripe | Left 2px steel-blue on hover | Left 2px violet on hover | Left 2px orange on hover |
| Selection | Checkbox for bulk | Radio for compare | Checkbox for bulk |
| Empty state | "Aucune donnée organique" | "Aucun signal IA observé" | "Aucun crawler détecté" |

### Charts

| Property | SEO | GEO | Agent |
|---|---|---|---|
| Primary color | `#6b9cc5` | `#7c6aef` | `#d4874a` |
| Fill opacity | 0.08 | 0.12 | 0.10 |
| Grid | Horizontal only, white/4% | None (clean) | Horizontal only |
| Tooltip bg | `--t-graphite` | `--t-graphite` | `--t-graphite` |

### Filters
- **Inline filter bar**: pills for active filters, ✕ to clear
- **Period selector**: "7j / 30j / 90j / Tout" segmented control in CommandStrip
- **Search**: ⌘K for global, inline input for in-page

### Drawers
- Slide from right, 420px wide, overlay with backdrop-blur
- `overscroll-behavior: contain`
- Close: ✕ + Escape + click outside
- Evidence drawers show raw proof in monospace

### Actions
- **Primary**: Violet filled button (one per page max)
- **Secondary**: Ghost button with border
- **Destructive**: Coral text, confirmation modal required
- **Inline**: Icon button + tooltip, no label

---

## 8. Twelve Signature Screens

### 1. Cockpit (Home `/admin`)
- Full stage, no tray. Archetype: **Cockpit**
- Hero: "Portfolio Pulse" — animated ring chart (critical/attention/stable)
- "Next decision" card — most urgent mandate + reason + CTA
- Bottom: horizontal scroll strip of mandate cards, sorted by attention

### 2. Portefeuille (`/admin/clients`)
- Full stage. Archetype: **Registry**
- Dense table: health dot, name, lifecycle badge, freshness, top issue tag
- Inline expansion: click row → mini-dossier (3 KPIs + quick nav)
- Top: search + filter pills (lifecycle, attention, freshness)
- Status summary bar above table
- Empty/loading/error states

### 3. Fiche Mandat (Client Dossier)
- Archetype: **Dossier**
- 60/40 split: left identity + timeline, right action queue + connector bus
- Identity strip: horizontal bands (name, type, website, lifecycle)
- Timeline: vertical filmstrip with colored dots per event type
- Connector bus: linear segments with status dot + last sync

### 4. SEO Situation (SEO Overview)
- Archetype: **Cockpit** with steel-blue accent
- Hero: organic visibility score (large number) + sparkline behind
- 3-column breakdown: positions won / lost / technical health
- Each column: single metric + mini bar + link to detail

### 5. Inspecteur On-Page
- Archetype: **Inspector**
- Left: page list with health grade (A/B/C/D/F)
- Right: inline detail (title, meta, headings, issues)
- No drawer — detail replaces list on mobile, side-by-side on desktop

### 6. GEO Situation (GEO Overview)
- Archetype: **Cockpit** with violet accent
- Hero: AI visibility composite score + verdict + trend area
- Model performance strip: horizontal scroll of model cards
- 2-column bottom: live feed left, source footprint chart right

### 7. Sources & Citations (GEO)
- Archetype: **Registry** — signature "Source Influence Matrix"
- Dense table: source domain, citation count, reliability, trend
- Filter by model, by prompt category
- Click row → evidence drawer showing actual citations

### 8. Prompts Workbench (GEO)
- Archetype: **Workbench**
- Left (280px): prompt list with search, grouped by category
- Center: selected prompt detail — query, expected answer, results
- Right (300px): run history + evidence snippets

### 9. Comparaison Fournisseurs (GEO)
- Custom comparison layout
- Provider selector tabs (ChatGPT, Gemini, Perplexity, etc.)
- Side-by-side response viewer, one column per provider
- Diff highlights: mention / no-mention per provider

### 10. Agent Situation (Agent Overview)
- Archetype: **Cockpit** with orange accent
- Hero: agent readiness score (gauge) + verdict
- 4 dimension cards: Visibility, Readiness, Actionability, Protocols
- Each card: score + horizontal bar + top blocker

### 11. Correctifs Agent
- Archetype: **Action Queue**
- Priority-sorted list with severity pill + category tag
- Inline expand: description, evidence, suggested fix
- Bulk actions: "Mark resolved"

### 12. Actions GEO (GEO Opportunities)
- Archetype: **Action Queue** with violet accent
- Grouped by type: content, technical, citation, brand
- Evidence drawer: right slide with proof + suggested prompt

---

## 9. Implementation Rules for Codex

### Rule 1: Shell First
Implement Rail → Tray → CommandStrip → Stage before any page work.

### Rule 2: Tokens Before Components
Update `admin-shell.css` with `--t-*` tokens. Create mapping from old `--cmd-*`. Never hardcode colors.

### Rule 3: One Archetype Per Page
Declare archetype + justification + data sources + operator action before coding.

### Rule 4: Service Accent via Context
Pass service accent through context or CSS custom property. Components read `--service-accent` — never hardcode per-world colors in leaf components.

### Rule 5: Preserve Scroll Model
`.geo-shell` → `.geo-main` → `.geo-content` stays. Rail + Tray replace `.geo-sb`. `geo-content` remains the single scroll viewport.

### Rule 6: Black-First
Canvas is `--t-black`. No surface darker than obsidian. Accents appear on dots, pills, active indicators — never as backgrounds larger than a chip.

### Rule 7: Evidence-First
Every metric links to proof. Every action links to evidence. If no evidence exists, show "Preuve insuffisante" with a CTA to collect.

### Rule 8: No Data Fabrication
All pages handle 4 states: Loading (skeleton), Empty (CTA), Error (recoverable message), Data (real layout). Never show fake data.

---

## 10. Migration Order

| Phase | Scope | Validates |
|---|---|---|
| **Phase 0** | Token system + CSS foundation | Black-first, typography scale, surface tiers |
| **Phase 1** | Shell (Rail + Tray + CommandStrip + Stage) | Navigation architecture, scroll model, client context |
| **Phase 2** | Portfolio pages (`/admin`, `/admin/clients`) | Cockpit + Registry archetypes, table density, filters, cards |
| **Phase 3** | One complete service vertical (GEO recommended) | All 6 archetypes, evidence-first, charts, drawers |
| **Phase 4** | SEO world | Steel-blue accent, inspector pattern, local pages |
| **Phase 5** | Agent world | Orange/indigo accent, workflow canvas, logs |
| **Phase 6** | New signature pages (answers, sources matrix, workflows, logs) | Differentiating screens |
| **Phase 7** | Phase 2 additions (comparaison mandats, rapport opérateur) | Reporting layer |

> Portfolio pages (`/admin` and `/admin/clients`) **define the tone** of the entire admin. Shell + Portfolio must be validated before migrating service worlds.

---

## Verification Plan

### Browser Verification
- Load `/admin` → Rail renders, no tray (portfolio mode)
- Click client → Tray appears with client context nav
- Switch SEO/GEO/Agent in Rail → Tray content changes, accent shifts
- Verify scroll model: only `.geo-content` scrolls
- Mobile: Rail collapses, Tray becomes slide-over
- ⌘K opens command palette from any page

### Visual Audit
- Canvas reads as **black/graphite** at first glance
- No accent color dominates any surface
- Page titles render at 28–36px with premium presence
- Hero numbers render at 40–56px
- Each page uses one declared archetype
- Every metric has visible evidence link or "Preuve insuffisante"
- No banned patterns (KPI grids, decorative charts, fake live indicators)
