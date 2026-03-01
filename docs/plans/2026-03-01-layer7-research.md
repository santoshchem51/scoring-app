# Layer 7: Player Profiles & History — Research

**Date:** 2026-03-01
**Status:** Research complete, ready for Wave A brainstorming

---

## Wave Breakdown

Layer 7 is split into 4 waves, each with its own brainstorm → plan → TDD cycle:

| Wave | Scope | Depends On |
|------|-------|------------|
| **A — Data + Rating Engine** | Profile model in Firestore, Glicko-2/OpenSkill rating engine, rating calculation triggered on match completion | Nothing (foundation) |
| **B — Profile Page** | Profile header, stat cards, tabs (Overview/Stats/Matches/Badges), edit profile, match history cards | Wave A |
| **C — Leaderboards** | Ranking queries, scoped views (club/friends/global), leaderboard page UI | Wave A |
| **D — Achievements** | Badge definitions, milestone trigger logic, trophy case UI, inline match badges | Wave A + B |

---

## 1. Competitor Landscape

### DUPR (dupr.com) — The Dominant Rating System
- **Rating**: Modified Elo, 2.000–8.000 scale, separate singles/doubles
- **Reliability Score**: 1–100% confidence indicator (separate for singles/doubles)
- **July 2025 shift**: Performance-vs-expectation model — you can gain rating in a loss if you outperformed prediction; 0.1 DUPR gap ≈ 1.2 expected points in an 11-point game
- **Profile**: Name, location, rating, reliability, W/L record, scatter plot of results over time, club memberships, social feed
- **Match history**: Full chronological log, filterable singles/doubles, public/private toggle
- **Leaderboards**: Global (by gender/geography), club rankings, collegiate
- **Unique**: DUPR Reset ($34.99 — play 8+ matches, keep whichever rating is higher), social feed, 1M+ players
- **Key insight**: Verified (tournament) vs self-reported (rec) match distinction affects rating weight

### PicklePlay / UTR-P (pickleplay.com) — Community + Official USA Pickleball Rating
- **Rating**: UTR-P scale 1.0–10.0, separate singles/doubles/mixed
- **Verified vs unverified** results reduce sandbagging
- **1 match** → projected rating; **7 matches** → reliable decimal rating
- **Strength**: GPS court finder (32K+ courts), open play scheduling, club management (Club+)
- **Pricing**: Free / $19.99/yr Pro

### Scoreholio (scoreholio.com) — Tournament Scoring + SPR Rating
- **SPR**: 1–100 scale (start at 50), Elo-like, 10-game provisional period
- **DUPR integration**: Link accounts, auto-submit tournament results
- **Profile**: SPR, trophy room (animated, shareable), game history + charts (SPR+ only)
- **Leaderboards**: Global + club, filterable by sport
- **Unique**: Multi-sport (pickleball + cornhole), QR code check-in, freeplay scoreboard, player self-scoring
- **Pricing**: Free to play; SPR+ $19.99/yr gates detailed history

### PickleConnect (pickleconnect.com) — Directory / Lifestyle
- **No rating system** (self-reported skill only)
- **No match history** — focused on court/tournament/instructor directory
- **Unique**: Stay-and-play travel features, international focus
- **Not a competitor** for profiles/ratings, but shows the "discovery" side of the market

### Summary Table

| Feature | DUPR | PicklePlay | Scoreholio | PickleConnect |
|---------|------|------------|------------|---------------|
| Rating system | Modified Elo (2–8) | UTR-P (1–10) | SPR (1–100) | None |
| Separate singles/doubles | Yes | Yes (+mixed) | Via DUPR link | N/A |
| Confidence metric | Reliability % | Verified/unverified | Provisional period | N/A |
| Score margin impact | Minimal | Unknown | No | N/A |
| Match history | Full, public/private | League/ladder | Full (SPR+ gated) | None |
| Leaderboards | Global, club, collegiate | Club/ladder | Global, club | None |
| User base | 1M+ | ~150K | Multi-sport, growing | Niche |
| Pricing | Free (Reset $35) | Free / $20/yr | Free / $20/yr | Free |

---

## 2. Rating Algorithms

### Comparison

| Criteria | Elo | Glicko-2 | OpenSkill (Weng-Lin) | DUPR | Win % |
|----------|-----|----------|----------------------|------|-------|
| Core idea | Expected vs actual | Elo + confidence + volatility | Bayesian team inference | Modified Elo for PB | Wins / total |
| Scale | ~1000–2000 | ~1000–2000 | mu - 3*sigma (~0–50) | 2.0–8.0 | 0–100% |
| Doubles support | Hack (avg) | Hack (composite opponent) | **Native** | Native | Trivial |
| Confidence metric | None | **RD (excellent)** | **Sigma** | Reliability % | None |
| Score margin | No (extensible) | No (extensible) | TrueSkill 2: Yes | Minimal | Can add |
| Cold start | 20–30 games | 15–20 games | 20–30 games (2v2) | 10–20 games | 30–50 games |
| Inactivity handling | None | **RD increases** | Sigma increases | Reliability drops | Stale |
| Complexity | Very low (~20 LOC) | Moderate (~200–400 LOC) | Moderate (npm lib) | Proprietary | Trivial |
| JS/TS libraries | Many | `glicko2`, `glicko2.ts` | `openskill` | N/A | N/A |
| Licensing | Open | Open | Open | Proprietary | Open |
| Best for | Simple 1v1 | 1v1 with confidence | Team games (2v2+) | PB ecosystem | Casual |

### Recommendation: Modified Glicko-2 (primary) + OpenSkill (evaluate)

**Why Glicko-2:**
1. **RD (Rating Deviation)** is a killer feature — naturally shows "provisional" vs "established" status
2. **Inactivity handling** — RD increases when inactive, rating re-calibrates faster on return
3. **Volatility tracking** — identifies inconsistent players
4. Existing TypeScript library (`glicko2.ts`), composite opponent method documented for doubles
5. Extensible with score-margin multiplier (map 11-0 → 1.1 "stronger win", 11-9 → 1.02 "narrow win")

**Display mapping** to pickleball-friendly scale:
```
displayed_rating = 2.0 + (glicko_rating - 1000) / 250
```
→ Glicko 1500 displays as "4.0" (familiar to DUPR users)

**Why not others:**
- **Elo**: No confidence metric — can't distinguish 2-game vs 200-game player
- **TrueSkill**: Microsoft patent restricts commercial use; OpenSkill is the patent-free alternative
- **DUPR**: Proprietary, can't self-implement (consider optional API integration later)
- **Win %**: Too crude as primary, but excellent as secondary stat

**OpenSkill as dark horse:** Native doubles support, patent-free, `openskill` npm package. Worth prototyping alongside Glicko-2 during Wave A to compare accuracy.

---

## 3. UI/UX Patterns

### Profile Page — Above the Fold

All top apps (DUPR, Chess.com, Strava, Valorant Tracker) follow this hierarchy:

| Priority | Content | Pattern |
|----------|---------|---------|
| 1 | Avatar + Name | Large avatar (64–96px), name, optional level badge |
| 2 | Primary Rating | Large, bold number — the single most important stat |
| 3 | Secondary Metrics | 2–4 numbers in horizontal bar (W/L, win %, streak) |
| 4 | Rating Trend | Sparkline or mini-chart showing direction |
| 5 | Tab Navigation | Overview / Stats / Matches / Badges |

### Recommended Profile Layout

```
+----------------------------------------+
| [Avatar]  Player Name                  |
|           Member since Jan 2026        |
|           [Edit Profile]               |
+----------------------------------------+
|  DOUBLES    |  SINGLES    |  OVERALL   |
|   4.12      |   3.85      |   67% W    |
|   ▲ +0.3    |   NR        |   42-21    |
|   ~~~~~~~~  |             |            |
|  (sparkline)|             | (donut)    |
+----------------------------------------+
| [Overview] [Stats] [Matches] [Badges]  |
+----------------------------------------+
| RECENT FORM:  W W L W W W L W W W     |
| CURRENT STREAK: 4 Wins                 |
+--- Match History (Cards) -------------+
| [W] vs. John & Sarah    11-7, 11-4    |
|     Feb 28 · Doubles · Side-out       |
|     ★ Comeback win                     |
+----------------------------------------+
| [L] vs. Mike & Lisa     9-11, 11-8..  |
|     Feb 26 · Doubles · Rally          |
+----------------------------------------+
```

### Match History Patterns

| Pattern | Used By | Best For |
|---------|---------|----------|
| Color-coded list rows | OP.GG, Chess.com | High-density scanning |
| **Cards** | Strava, NRC, Valorant | **Recreational users, mobile touch targets** |
| Timeline/Calendar | Strava profile | Consistency visualization |

**Recommendation:** Card-based list with green/red left border for W/L, tap to expand.

### Rating Visualization

| Visualization | Used By | Recommendation |
|---------------|---------|---------------|
| Big number + trend arrow | DUPR, Valorant | **Hero stat** on profile header |
| Sparkline (last 10–20) | Valorant Tracker | **Next to rating** for recent form |
| Win/Loss donut | Chess.com | **Overall record** at a glance |
| Line chart with timespan | Chess.com, Lichess | **Stats tab** deep dive |
| Percentile ("better than 72%") | Chess.com | **Motivating context** for the rating |
| Scatter plot | DUPR | Consider for stats tab |
| Reliability indicator | DUPR | **Essential** — maps to Glicko-2 RD |

### Leaderboard Best Practices

1. **Multiple timeframes** — weekly (default), monthly, all-time
2. **User-centric** — always show current user's position with 2–3 above/below
3. **Scoped** — friends/club/global filters (friend/club >> global for engagement)
4. **Top 3 podium** — special visual treatment, then compact list below
5. **Segmented** — by skill level to keep competition motivating
6. **Real-time** — update after every match

### Achievement Badges

| Type | Example | Psychology |
|------|---------|------------|
| Milestone | "100 Matches Played" | Rewards commitment |
| Streak | "10 Win Streak" | Encourages consistency |
| Improvement | "Rating Up 0.5 This Month" | Rewards growth |
| Social | "Played with 20 Different Partners" | Encourages community |
| Achievement | "First Shutout (11-0)" | Celebrates moments |
| Consistency | "Played 4 Weeks in a Row" | Drives retention |

### Progressive Disclosure (3 levels)

**Level 1 — Glance (header):** Name, avatar, rating, W-L, streak, last played
**Level 2 — Summary (overview tab):** Win rate, recent form sparkline, doubles/singles split, 30-day chart, top partners
**Level 3 — Deep dive (stats tab):** Full rating history, head-to-head records, scoring patterns, monthly trends

### Mobile-First PWA Considerations
- Design for 375px width first, scale up
- 48px minimum tap targets
- Lazy-load below-fold content (charts render on scroll/tab select)
- Offline-first: render from IndexedDB cache, show "Last updated" timestamp
- Tab navigation to organize depth without overwhelming

---

## 4. PickleScore's Opportunity

Nobody in the market nails the full **profile + history + local rating + achievements** experience in a clean mobile-first PWA:
- **DUPR** = ratings-only platform
- **Scoreholio** = tournament ops with ratings bolted on
- **PicklePlay** = community/discovery focus

PickleScore can own the **complete player experience** — score your games, track your progress, see your rating grow, earn achievements, compare with friends — all in one offline-first PWA.

---

## Next Steps

1. **Brainstorm Wave A** — Data model + rating engine design decisions
2. Write Wave A plan → TDD implementation
3. Repeat for Waves B, C, D
