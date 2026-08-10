# CLAUDE-v2-PROPOSAL.md — a draft constitution for Boo Town

**Status: a proposal, not a decree.** Alex's to adopt, edit, or bin. Written 10 Aug 2026 by
the overnight audit lane, from one frame only: *the end result for the children*.

Alex's brief for this document: most standing rules were written by agents, are not his
rules, and must not hold the game back. So every rule below is graded:

- **KEEP** — it protects something a child would miss. The experience it protects is named.
- **RELAX** — the intent is right, the letter is over-tight. A rewrite is drafted.
- **RETIRE** — it was for a problem that is now solved, or it costs more than it protects.

The six protected-core items in `GOVERNANCE-TONIGHT.md` §2 are pre-graded KEEP and are
listed first so the constitution reads top-down. Everything else is argued on merits.

**The one-line test I applied to every rule:** *if this rule vanished tomorrow, what would
get worse for a nine-year-old and a four-year-old?* If the answer is "nothing they'd
notice, but agents would misbehave", it is process, not law — and it belongs in a working
handbook, not in the constitution.

---

## Part 0 — The reason the rest exists

> **Boo Town is a place a child is glad to come back to.** It teaches while she plays,
> never while she waits. Everything else in this document exists to protect that sentence.
> Where a rule and that sentence disagree, the sentence wins and the rule gets rewritten.

*Why this belongs at the top:* the current CLAUDE.md opens with file inventory ("Vanilla
HTML/JS/CSS. No frameworks."). An agent reading top-down learns the constraints before it
learns the point. Tonight's whole delegation exists because the rules had drifted away from
the child; a stated purpose is what stops that drift recurring.

---

## Part 1 — The protected core (KEEP, not challengeable)

These six are the constitution. They are the ones a child, a parent, or a court would care
about. Nothing below Part 1 may be read as overriding them.

| # | Rule | The experience it protects |
|---|---|---|
| 1 | **Kind by construction.** Nothing decays, nothing shames, absence is never punished, wrong is never failure. Stars never shrink. | She can leave for a month and come back to "You're back! The Boos missed you." A game that punished her absence would be a game she'd learn to dread opening. This is the single most load-bearing rule in the file. |
| 2 | **Privacy absolute.** No accounts, no tracking, no telemetry, no child's name leaving the device. | A child's play data is nobody's business. Also the only rule here with legal weight. |
| 3 | **Fully offline once installed.** All data on-device. | The game works in the car, on a plane, at Grandma's with no wifi. Every child-visible feature must survive a dead network. |
| 4 | **Saves are never lost.** Migrations lossless; a parse failure never starts fresh. | Her town is two years of her own work. Losing it is the only unrecoverable harm this app can do. |
| 5 | **Licence-clean only.** No copyrighted melodies, art, or unverified assets. | Protects the family, not the code. |
| 6 | **Accessible by default.** AA contrast, reduced-motion paths, reachable tap targets. | A child who can't read the gold letters or hit the button doesn't get the game at all. |

**Amendment adopted from tonight (§3a'), folded in as drafted text under core rule 5:**

> Real, licence-verified sound samples (CC0 or Pixabay licence, recorded in an in-repo
> manifest with source URL and licence) may ship in-repo, same-origin and precached, where
> synthesis or TTS is genuinely worse for the child. Music remains original composition.
> The manifest is part of the deliverable: an asset whose licence cannot be shown in the
> repo does not ship.

---

## Part 2 — Rules graded

### 2.1 "Hard laws" (current CLAUDE.md §Hard laws)

| Rule | Grade | Reasoning |
|---|---|---|
| Zero runtime network requests | **KEEP** (core 2+3) | Not just privacy — it is *why* the game works offline. The one `fetch()` in the tree is on a `data:` URL and guarded by a suite. Keep the guard. |
| No accounts/ads/tracking; data on-device; mic only for opt-in voice | **KEEP** (core 2) | — |
| Kid-safe and gentle; no guilt mechanics | **KEEP** (core 1) | — |
| No real-world song melodies | **KEEP** (core 5) | — |
| **Learning content implemented exactly as written in briefs** | **RELAX** | This rule was written to stop agents "improving" a phonics list into mush — a real failure mode. But tonight it also blocks fixing content that is *wrong*, un-British, or duplicated, and blocks adding content where a game is visibly thin. Fidelity should be owed to the child, not to the brief. **Drafted rewrite below.** |
| **Never commit secrets, tokens, or personal names** | **KEEP, and strengthen** | Tonight's audit found this rule is currently *not being met*: children's first names remain reachable in public git history (commit `82a6806`, subject line included), and `HANDOVER-*.md` — a file class the .gitignore itself declares "never published" — is tracked and published. The rule is right; the enforcement needs a pre-push grep and a periodic history check. See §4.1. |

**Drafted rewrite — learning content:**

> **Learning content is owed fidelity to the child, not to the brief.** Implement authored
> content as written *unless* it is wrong, unclear, un-British, or duplicated — in which
> case fix it and log before/after in the ledger. You may ADD content where a game is thin,
> provided additions match the data shapes and validators, map to the curriculum line they
> serve, and are listed in full in the ledger for a cold read. Wholesale replacement of a
> game's content set is a maintainer decision, not an executor's.
> **What is NOT relaxed:** mechanics and choreography. Where a pack specifies how a thing
> behaves, build what it says — invented mechanics have proven shallow every time.

### 2.2 Architecture contracts

All eight are **KEEP** — they are the reason a ~1MB no-build vanilla app is still coherent
after twenty-one runs, and each one prevents a specific, observed failure: parallel routers,
strings scattered across files, emoji standing in for art, a second audio path that ignores
the mutes, a save schema change without a migration. Two amendments:

- **OFFLINE LAW — KEEP, and add a mechanical check.** This is the rule with the highest
  cost-of-failure *and* it is the rule that failed tonight: `js/playjournal.js` is statically
  imported by `js/main.js` but is missing from `sw.js` ASSETS[]. It was added correctly in
  its own commit and then silently dropped by a bad `sw.js` merge resolution — exactly the
  failure a human review does not catch. The rule should therefore not read "remember to add
  it"; it should read: *"a test enumerates js/ and data/ and fails if any file reachable
  from index.html's import graph is absent from ASSETS[]; merges that touch sw.js re-run it."*
  A law that depends on an agent remembering, during a merge, is not a law.
- **Art: "no emoji-as-art in game scenes" — KEEP with a stated boundary.** The tree honours
  this in scenes; emoji are used in *chrome* (What's New icons, hub chips, the 👀 hint line).
  That distinction is correct and worth writing down, because the current phrasing invites an
  agent to "fix" perfectly good chrome.

### 2.3 Working loop

| Rule | Grade | Reasoning |
|---|---|---|
| Commit AND push at sub-steps | **KEEP** | Cheap; protects against a PC switched off mid-run. |
| Deploy gate: bump stamp → What's New → push → confirm live stamp → update PROGRESS.md | **KEEP** | The live-stamp confirmation is the only thing that catches "shipped to a branch, not to the child". |
| Regenerate PROJECT_STATE.md at every run's final gate | **RELAX → make it a hook, not a rule** | A generated file that an agent must remember to regenerate is a rule that will be broken silently. Either run it in a pre-push hook or accept it may be stale. It is a doc, not an experience. |
| **What's New is part of the deploy gate** | **KEEP — this is the best rule in the file** | "A feature the children are never told about may as well not have been built." That single sentence has done more for this app than any test. It is also self-policing: the routes are asserted. Tonight's audit resolved all 70 entries across 22 blocks and found zero broken routes. |
| Never advertise anything a grown-up has to switch on | **KEEP** | Prevents the cruellest possible card: telling a child about something she cannot reach. |
| **Truth outranks completeness in What's New** (the withdrawn "Boos walk on your paths" precedent) | **KEEP, and promote it to explicit law** | It is currently only implicit in a commit message. It deserves a line: *"An entry describing behaviour a child cannot see is withdrawn, even if the mechanism exists. Worse than saying nothing is saying something untrue."* This is the rule that keeps the game honest with a child who is old enough to check. |
| Blocked twice → BLOCKED.md and move on; never idle; never improvise | **KEEP** | Hard-won. Improvised alternative designs are the documented shallow-failure mode. |
| **Push auth failure → record in NEEDS_ALEX.md** | **RETIRE as a blocker, KEEP as a note** | Superseded by tonight's governance §1: agents decide and record rather than park. NEEDS_ALEX becomes an inbox for the five genuinely-escalating classes (money/accounts, children's privacy, deleting a child-visible feature, unverifiable licences), not a parking bay. |

### 2.4 The Board Law (testing)

The amended (targeted) regime is the right shape and is **KEEP** in substance. Three
observations from running it tonight:

| Rule | Grade | Reasoning |
|---|---|---|
| Per-packet smoke; per-gate affected-suites-plus-core; no full board mid-run | **KEEP** | Proportionate. The full-board regime demonstrably cost more than it caught. |
| Five-suite core at every gate | **KEEP, with one addition** | Core should include the ASSETS-completeness check described in §2.2 — tonight's S1 would have been caught at the gate that shipped it. `m3-pwa` is in the core but evidently does not enumerate the import graph. |
| Known flakes are flakes on sight; ONE serial re-run | **KEEP** | Prevents re-running until green, which is how false confidence gets manufactured. |
| `walk.mjs` as pre-merge smoke | **KEEP** | It is the only check that walks where a child walks. Cheap insurance for ten minutes. |
| Evidence standards (6+ frames over 3+ seconds; three viewports) | **KEEP** | This is what stopped "working-but-dead" shipping as done. |
| **"One dedicated full-board sweep at the very end of the programme"** | **RELAX** | It has never happened (HANDOVER §1 calls it "the one real debt"). A rule that has never once been executed is not binding anyone; it is guilt. Replace with: *"a full board runs when the maintainer asks for one, and its result is recorded with a date. Until then, the targeted regime is the regime."* |
| Never edit a file while suites are in flight | **KEEP** | — |

### 2.5 Quality bar

| Rule | Grade | Reasoning |
|---|---|---|
| **Working-but-dead is a FAIL** | **KEEP — promote to Part 0** | This is a purpose statement wearing a rule's clothes. It belongs beside "a place a child is glad to come back to". |
| Every game teaches itself: 3-step skippable intro + "?" replay | **KEEP** | Verified in play tonight: Bubble Pop's intro ("Wrong pops just wobble — try again, no worries!") is exactly the tone this rule buys. |
| No more than 8 primary option buttons at phone width | **KEEP as a heuristic, RELAX the letter** | An audit already found raw counts exceed 8 on several screens because gameplay grids and palettes are counted. Rewrite as: *"no more than 8 primary **choices** at phone width; gameplay surfaces (keyboards, palettes, grids) are not choices."* |
| Empty and first-run states are part of every screen | **KEEP** | Tonight's best small moment was an empty state: the Expedition's "An expedition needs 8 brave Boos — open a few more mystery boxes first!" with a working button. Contrast the *worst*: a brand-new save greeted with "Something new arrived! 70 things to see", which is neither new nor welcoming. See seed S-04. |

### 2.6 Experience laws (2026-07-27)

These five are the youngest rules and, on tonight's evidence, the highest-yield.

| Rule | Grade | Reasoning |
|---|---|---|
| **Engine reuse** | **KEEP** | Prevents the second music system, the second pan loop, the second router. |
| **No dead props** | **KEEP, and extend to VERBS-FOR-MOMENTS** | Currently protects *placeables*. Tonight's biggest delight gap was not a dead prop but a **dead moment**: in Boo Expedition, a Boo crossing a bridge is a caption, not a crossing. Proposed extension: *"Every moment the child causes ships with at least one of: motion, a sound, or a change she can point at. A result printed as text is not a moment."* |
| **Continuity** | **KEEP** | — |
| **Announced moments** | **KEEP — the most valuable of the five** | It is the rule that catches "the state changed but nothing happened". Extending it (above) would have caught the Expedition finding. |
| **Curriculum mapping** | **KEEP** | It is what makes this an educational app rather than an app with sums in it. |

---

## Part 3 — What is missing from the constitution (proposed additions)

1. **A discoverability law.** Nothing currently requires that a child can *find* a feature
   without being told. The Path Pot, resize-after-drag and Undo are all discoverable only
   via a What's New card that a returning child dismisses once and never sees again.
   Proposed: *"Every child-facing feature has an in-world route to discovery — a beat, a
   hint, a visible affordance — not only a What's New card. The card is the announcement;
   it is not the teaching."*
2. **A time-to-first-delight budget.** Proposed: *"From opening any area, something the
   child did not cause should move, speak, or sparkle within three seconds — or the area
   should say what it is waiting for."* The Pulse Director already implements exactly this
   and the one honest gap (an empty outdoor area gets no beat, only the 9-second
   invitation) is the case the budget would have flagged as needing a sixth rung.
3. **A copy-state law.** Hint copy should describe the state the child is actually in.
   Tonight a brand-new save with zero Boos was told "Tap a Boo to say hi!" in an empty
   meadow. Proposed: *"First-run copy is written for a child who owns nothing."*
4. **A decision log.** Tonight's §1 delegation (decide, record `DECISION/WHY/REVERSIBLE`,
   continue) worked and should be permanent. It converts every parked question into a
   reviewable call.

---

## Part 4 — Enforcement notes (not rules; how the rules stay true)

**4.1 Names and secrets.** The tracked tree is clean, but the rule as written says "never
commit", and the repo's *history* is public and still contains two children's first names —
including in a commit subject line. Options for Alex, none of which an agent should take
unilaterally: (a) accept it, since the names are common and unlinked to any identifying
data; (b) rewrite history (`git filter-repo`) and force-push, which breaks every clone and
existing link; (c) leave history, but stop the tracked `STATE_AUDIT.md` from signposting
exactly where to look. Separately: `HANDOVER-2026-07-31.md` is published despite the
gitignore class declaring that file class private — one `git rm --cached` fixes it.

**4.2 Rules that only exist in prose.** A dozen standing laws live scattered across
`PICK-UP-HERE.md` and run reports (`cameraClaimed`, the single pan primitive, `worldSoftened()`
as the arranging gate, one-port-per-worktree, on-camera seeding, drive the real mouse, stale
pins re-pointed never weakened). These are *good engineering handbook* content and bad
constitution content. Proposed split: **CLAUDE.md keeps only what protects the child's
experience; a separate HANDBOOK.md holds how-to-work-here knowledge.** A constitution that
mixes "nothing shames the child" with "port 8043 belongs to the review lane" teaches an
agent that both are equally negotiable — or equally sacred, which is worse.

---

## Part 5 — The proposed CLAUDE-v2 table of contents

If Alex adopts this, the file becomes:

```
0. What Boo Town is for              (the one paragraph; working-but-dead is a FAIL)
1. The protected core                (6 rules, never challengeable)
2. Experience laws                   (engine reuse · no dead props/moments · continuity ·
                                      announced moments · curriculum mapping ·
                                      discoverability · time-to-first-delight · copy-state)
3. Architecture contracts            (8, unchanged, + mechanical offline check)
4. How a run ships                   (deploy gate · What's New incl. truth-outranks-
                                      completeness · decision log · escalation list)
5. How much testing is enough        (the targeted board law, unchanged in substance)
→ HANDBOOK.md                        (everything else: ports, seeding, flakes, pan
                                      primitives, camera claims, merge order)
```

Net effect: the constitution shrinks to what a child would recognise as being about her,
and the operational knowledge stops competing with it for an agent's attention.
