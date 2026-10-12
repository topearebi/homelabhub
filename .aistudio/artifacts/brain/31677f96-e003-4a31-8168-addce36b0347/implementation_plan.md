# Revised Plan: Fast Web Search Launcher for Homelab Hub

Transform the Hub dashboard into an ultra-fast browser homepage launcher by seamlessly combining internal bookmark navigation with external web search (Google, DuckDuckGo, Ecosia, Qwant), strictly upholding Homelab Hub's core design principles, typography, profile boundaries, and cache maintenance protocols.

### User Review & Critical Decisions

> [!IMPORTANT]
> The plan is aligned with Homelab Hub's core principles:
> - **Fast Launcher First**: The hub is a fast launcher, not a bookmark manager. Everything is reachable in one tap or by "typing then Enter".
> - **Zero Clutter & No Tabs**: Retains a single scrolling page with no tabs.
> - **Profile Respect**: Kid profile remains completely search-free (big tiles only, no web search, PIN required to exit).
> - **Aesthetic Harmony**: Seamlessly adopts the existing warm paper light theme and warm charcoal dark theme, serif headings, and system sans body.
> - **Service Worker Maintenance**: Bumps `CACHE_VERSION` in `sw.js` upon completion so offline/PWA copies update immediately.

- **Confirmed Decision 1**: Unified search bar with contextual engine buttons that appear as you type and prominently if no internal links match.
- **Confirmed Decision 2**: Instant "Type then Enter" web navigation when no internal bookmarks match, launching the query directly into the selected search engine in a new tab.
- **Confirmed Decision 3**: Four curated search engines with distinct purposes:
  - **Google**: *AI Overviews & comprehensive web results*
  - **DuckDuckGo**: *Privacy-focused, zero tracking or profiling*
  - **Ecosia**: *Eco-friendly search that plants trees with ad revenue*
  - **Qwant**: *European privacy-first engine with neutral index*
- **Confirmed Decision 4**: Remembers chosen search engine across browser sessions in `localStorage` (`hub.searchEngine`), defaulting to Google.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades the Hub's central search bar into an intelligent launcher. As you type, internal services and apps (Jellyfin, Navidrome, My apps, etc.) are filtered instantly. Simultaneously, a quiet row of web search engine buttons lets you route queries to Google, DuckDuckGo, Ecosia, or Qwant. If a query matches no local links, hitting `Enter` immediately opens the web search in a new tab.
- **Target Audience**: Household members using Hub as their browser homepage on desktops, laptops, tablets, and phones.
- **Key Value**: Delivers the speed and omnibox convenience of a modern browser startpage without sacrificing self-hosted link discovery.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Idle Dashboard**:
   - Clean, quiet interface showing today's date, weather, theme switcher, and profile selector.
   - Pinned and categorized app tiles are displayed with warm serif section headings (`Watch`, `Listen`, `Read`, `My apps`, etc.).
   - Search bar shows `Search or jump to…` with `/` shortcut badge.
2. **Typing with Local Matches**:
   - The link grid updates instantaneously to show matching tiles.
   - A compact, unboxed search engine strip appears beneath the input:
     - Quick button: `Search Google for "query"` (or active engine)
     - Compact switchers: `DuckDuckGo`, `Ecosia`, `Qwant` with short hover/focus descriptors
   - Pressing `Enter` opens the highlighted local tile; pressing `Shift+Enter` or clicking an engine button immediately dispatches to web search.
3. **Typing with No Local Matches ("Fast Web Fallback")**:
   - The view renders an intuitive web search launchpad:
     - Heading: `Search the web for "query"`
     - Four clean engine action cards styled with Hub's warm border hairlines:
       - **Google**: *AI Overviews & comprehensive web results*
       - **DuckDuckGo**: *Privacy-focused, zero profiling*
       - **Ecosia**: *Eco-friendly search, plants trees*
       - **Qwant**: *European privacy & neutral results*
     - The active engine is highlighted with subtle contrast.
     - Pressing `Enter` immediately opens the search in a new tab using the active engine.
4. **Kid Profile Quarantine**:
   - Kid profile completely hides the search bar and web search buttons, keeping the experience locked down strictly to approved links.

#### Visual Identity & Theme
- **Color Palette & Theme Tokens**:
  - Light theme: Warm paper background (`#f6f4ef`), card surfaces (`#ffffff`), warm subtle borders (`#e6e2d8`), dark ink (`#1a1917`), warm muted text (`#736e65`).
  - Dark theme: Warm charcoal background (`#1a1917`), elevated surfaces (`#24221f`), borders (`#33302a`), light ink (`#ede9e0`), muted text (`#9c9589`).
- **Typography**:
  - Headings in classic serif styling (`Georgia, "Times New Roman", serif`), body in system sans (`system-ui, -apple-system, sans-serif`).
  - Search engine descriptions rendered in quiet `12px` muted text.
- **Anti-Slop Discipline**:
  - No candy badges or static pill capsules.
  - Interactive engine switchers are semantic, accessible `<button>` elements with keyboard focus outlines.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct "Type then Enter" Fallback**
  - *Chosen Approach*: When 0 bookmarks match, `Enter` immediately launches the web search query in a new tab without requiring mouse interaction or extra key presses.
  - *Why*: Directly aligns with Homelab Hub's core philosophy ("Everything is reachable in one tap, or by typing then Enter").
- **Decision 2: Seamless Profile Isolation**
  - *Chosen Approach*: Kid profile completely disables web search triggers and DOM elements. Guest and Admin profiles both receive web search capabilities.
  - *Why*: Preserves the household safety invariant established in the design notes.
- **Decision 3: Engine Selection Persistence**
  - *Chosen Approach*: Persist selected engine in `hub.searchEngine` in `localStorage`.
  - *Why*: Allows privacy-first (DuckDuckGo/Qwant) or eco-minded (Ecosia) users to set their default once and have every subsequent `Enter` query respect it.

---

### 4. Technical Architecture & Implementation Steps

```
┌─────────────────────────────────────────────────────────────┐
│                    Homelab Hub Viewport                     │
├─────────────────────────────────────────────────────────────┤
│ Top Bar: Salford weather · Date · Theme · Profile (PIN)     │
├─────────────────────────────────────────────────────────────┤
│ Search Bar (#search-bar) [Hidden in Kid profile]            │
│  ├── Input (#search)                                        │
│  └── Engine Quick Strip (#search-engines)                   │
├─────────────────────────────────────────────────────────────┤
│ Main Area (#main)                                           │
│  ├── When query empty: Pinned + Sections (Watch, Listen...) │
│  ├── When query matches local: Results Grid + Web Quick Bar │
│  └── When query matches none: Web Search Engine Launchpad   │
│       ├── Google      (AI Overviews & comprehensive web)    │
│       ├── DuckDuckGo  (Privacy focused, no tracking)        │
│       ├── Ecosia      (Plants trees with ad revenue)        │
│       └── Qwant       (European privacy & neutrality)       │
└─────────────────────────────────────────────────────────────┘
```

#### Detailed Implementation Plan:
1. **Engine Registry (`script.js`)**:
   - Define `SEARCH_ENGINES` object containing metadata, search query URL builders, SVG icons, and explanatory notes for Google, DuckDuckGo, Ecosia, and Qwant.
   - Add `state.searchEngine` loading from `store.get('hub.searchEngine', 'google')`.
2. **DOM Integration (`index.html` & `script.js`)**:
   - Add container `#search-engines` in `index.html`.
   - In `script.js`:
     - Update `renderResults()` to render the Web Search Launchpad with 4 engine cards and descriptive blurbs when `state.results.length === 0`.
     - When `state.results.length > 0`, render the unobtrusive web search quick-bar below the input.
     - Add `openWebSearch(query, engineKey)` which executes `window.open(url, '_blank', 'noopener')`.
     - Update keyboard navigation: `Enter` triggers `openWebSearch` when no local matches exist.
3. **Styling (`style.css`)**:
   - Add styles for `.search-engines`, `.engine-btn`, `.engine-launchpad`, and `.engine-card`.
   - Adhere strictly to the warm paper / charcoal palette, responsive layout, and focus rings.
4. **Service Worker Maintenance (`sw.js`)**:
   - Bump `CACHE_VERSION` from `v3.1.0` to `v3.2.0` so PWA and offline installations update immediately.
5. **Verification**:
   - Run compilation and tests to confirm zero regressions.
