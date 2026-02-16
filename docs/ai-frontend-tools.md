# AI Plugins & MCPs for Frontend Design

**Created:** 2026-02-16
**Status:** Research / Evaluation
**Context:** Exploring AI-powered tools and MCP servers to accelerate frontend design and development for PickleScore (SolidJS + Tailwind CSS v4).

---

## MCP Servers (Work with Claude Code)

### 1. Figma MCP Server (Official)

| | |
|---|---|
| **What** | Exposes live Figma design structure to Claude Code — hierarchy, auto-layout, variants, text styles, design tokens |
| **Key Tools** | `get_code` (frame-to-code), `get_variable_defs` (tokens), `get_code_connect_map` (component mapping) |
| **Framework** | Framework-agnostic (generates for any framework) |
| **Cost** | Free (requires Figma account) |
| **Maturity** | Production-ready (officially released Jan 2026) |
| **Link** | https://www.figma.com/blog/introducing-figma-mcp-server/ |

**Why it matters:** Design in Figma, point Claude Code at a frame, get SolidJS + Tailwind code. Best design-to-code pipeline available for our stack.

### 2. Magic UI MCP Server

| | |
|---|---|
| **What** | Animated Tailwind component library exposed via MCP — marquees, animated beams, text animations, shimmer buttons |
| **Framework** | React + Tailwind (need to adapt for SolidJS) |
| **Cost** | Free (open source) |
| **Maturity** | Production-ready |
| **Link** | https://magicui.design/docs/mcp |

**Why it matters:** High-quality animated components. Say "add a blur fade text animation" and get production code. Would need React→SolidJS adaptation.

### 3. FlyonUI MCP

| | |
|---|---|
| **What** | AI-powered Tailwind CSS v4 component generator integrated into IDE |
| **Framework** | React, Vue, HTML (adaptable) |
| **Tailwind v4** | Yes — built for v4's `@theme` and CSS-first architecture |
| **Cost** | Free (open source) |
| **Maturity** | Production-ready |
| **Link** | https://flyonui.com/mcp |

**Why it matters:** Explicitly supports Tailwind v4, which matches our stack. Generates semantic component classes.

### 4. shadcn/ui MCP Server

| | |
|---|---|
| **What** | Access to real shadcn/ui component source code, blocks, and metadata |
| **Framework** | React/Vue/Svelte (Solid UI is a port of shadcn) |
| **Cost** | Free (open source) |
| **Maturity** | Production-ready |
| **Link** | https://ui.shadcn.com/docs/mcp |

**Why it matters:** If we adopt Solid UI (shadcn port), this MCP helps Claude generate components using real source code rather than hallucinating APIs.

---

## Design-to-Code Tools

### 5. Builder.io Visual Copilot (Best for SolidJS)

| | |
|---|---|
| **What** | Figma-to-code with multi-framework support via Mitosis compiler |
| **SolidJS** | **YES** — one of the few tools that explicitly supports SolidJS |
| **Tailwind** | Yes (CSS, Tailwind, Emotion, Styled Components) |
| **Cost** | Free (basic) / $19/user/month (500 code generations) |
| **Maturity** | Production-ready |
| **Link** | https://www.builder.io/m/pricing |

**Why it matters:** The only major design-to-code tool that generates SolidJS output natively. Figma plugin → select frame → get SolidJS + Tailwind code.

### 6. v0.dev by Vercel

| | |
|---|---|
| **What** | AI UI generator from natural language or screenshots — generates React + Tailwind + shadcn/ui |
| **SolidJS** | No (React-only) |
| **Cost** | Free ($5 credits/mo) / $20/month Premium |
| **Maturity** | Production-ready, widely used |
| **Link** | https://v0.app |

**Why it matters:** Great for rapid prototyping and inspiration. Generates React code that needs manual conversion to SolidJS, but useful for getting layout ideas and component patterns quickly.

### 7. Screenshot to Code (Open Source)

| | |
|---|---|
| **What** | Converts screenshots/mockups to code using Claude, GPT-4, or Gemini |
| **SolidJS** | No (HTML/Tailwind/React/Vue — but extensible) |
| **Cost** | Free (self-hostable) |
| **Maturity** | Production-ready |
| **Link** | https://github.com/abi/screenshot-to-code |

**Why it matters:** Take a screenshot of any UI you like → get Tailwind code → adapt to SolidJS. Free and self-hosted. Good for rapid prototyping from visual references.

---

## AI App Builders (Full-Stack)

### 8. Bolt.new by StackBlitz

| | |
|---|---|
| **What** | Full-stack AI web app builder with browser IDE |
| **SolidJS** | Possible (supports multiple frameworks) |
| **Cost** | Free (150k tokens/day) / $20/month Pro |
| **Maturity** | Production-ready |
| **Link** | https://bolt.new |

**Why it matters:** Can generate entire pages/features from descriptions. More useful for prototyping new pages than modifying existing code.

---

## Tailwind CSS v4 AI Tools

### 9. CodeGPT Tailwind v4 Assistant

| | |
|---|---|
| **What** | AI assistant specialized in Tailwind v4's CSS-first architecture, container queries, CSS variables |
| **Cost** | Free |
| **Link** | https://www.codegpt.co/agents/tailwind-css-v4 |

### 10. CodeRocket

| | |
|---|---|
| **What** | Production-ready Tailwind v4 websites and components with AI |
| **Framework** | React, Vue, Svelte, Angular |
| **Cost** | Not detailed |
| **Link** | https://www.coderocket.app/ |

---

## Recommendation for PickleScore

### Immediate Setup (Free)

1. **Figma MCP Server** — Add to `.claude/settings.json` MCP config. Design screens in Figma, generate code via Claude Code. Framework-agnostic so works with SolidJS.

2. **FlyonUI MCP** — Add for Tailwind v4 component generation. Matches our stack.

### When Starting P1 (Discovery) Design Work

3. **Builder.io Visual Copilot** ($19/mo) — Only tool with native SolidJS support. Worth it when we need to convert Figma designs to SolidJS components at scale.

### For Prototyping / Inspiration

4. **v0.dev** (Free tier) — Generate React prototypes from descriptions, adapt patterns to SolidJS manually.

5. **Screenshot to Code** (Free, self-hosted) — Convert any UI screenshot to Tailwind code as a starting point.

### Not Needed Yet

- Magic UI MCP, shadcn MCP — useful but React-focused; wait until we see if Solid UI adoption justifies them
- Bolt.new — overkill for adding features to an existing app
- CodeRocket — wait for SolidJS support

---

## SolidJS Limitation

Most AI frontend tools target **React** as the primary framework. For PickleScore:

- **Design-to-code tools** will mostly generate React output → manual `className`→`class`, destructuring→`props.foo`, `useState`→`createSignal` conversion needed
- **Figma MCP** is the best option because it's framework-agnostic — Claude Code can generate SolidJS directly from design context
- **Builder.io** is the only tool with explicit SolidJS output support

The practical workflow: **Figma designs → Figma MCP → Claude Code generates SolidJS + Tailwind directly**.
