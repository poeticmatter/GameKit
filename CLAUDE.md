# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GameKit: the game lab's shared multiplayer platform (poeticmatter/game-lab). Games depend on it through a pinned release tag (`"game-kit": "github:poeticmatter/GameKit#vX.Y.Z"`), so a change here reaches a game only when that game bumps its tag. It ships TypeScript source; consumers compile it (see README for the Vite settings they need).

## Commands

```bash
npm run lint     # tsc --noEmit, strict
npm test         # vitest
npm pack         # tarball for trying a change in a game before releasing
```

## Layout

- `src/core/`: shared by both modes and never imported by games directly.
  - `config.ts` (`GameConfig`, table naming), `matchTable.ts` (Supabase client per page), `roomLink.ts` (codes, URLs, `Seating`/`PlayMode`), `browserMemory.ts` (localStorage with fallbacks), `random.ts` (seeded Mulberry32 and shuffle), `seatDisguise.ts` (which seat's look each seat wears in a solo playtest).
  - `useRoomRow.ts`: keeps an async room's row on screen: Realtime, catch-up on focus and on a slow poll, never showing an older version than it has.
  - `useHostPeer.ts` / `useHostLink.ts`: the PeerJS host and guest connection lifecycles (the guest reconnects with backoff).
  - `controls.tsx`, `screens.tsx` (status screens, share link, lobby frame, play-mode picker), `useTurnTitle.ts`.
- `src/simultaneous/`: two players, plans committed at the same time (`resolveTurn`). Type names match the original game-template platform so older games can switch by changing imports. Async rows have `turn`, `p1_plan`, `p2_plan`, `p2_joined`.
- `src/turns/`: 2–N players in turn order (`activePlayer` / `applyMove`, `IllegalMoveError`). A player's turn is a draft on their screen (`turnDraft.ts`, `useTurnDraft.ts`, `TurnBar.tsx`) until they end it, and `irreversibleReason` marks moves that can't be undone. Async rows have `players`, `player_count`, `state`, `version`; seats are claimed through the `<id>_claim_seat` RPC.
  - `playtest/`: the solo playtest (`'solo_playtest'`), one tester playing every seat. `session.ts` deals turns across several tables with the played seat disguised as seat 0 (boards draw seats through `BoardProps.lookOf`); `summary.ts` reads results by turn position via the optional `GameRules.outcome`; `storage.ts` keeps the playtest in localStorage so a reload resumes it.
- Each mode's `index.ts` is its public API, re-exporting the core pieces games use (`GameConfig`, `supabaseFromEnv`, controls, `nextRandom`/`nextIndex`, `Seating`). `src/theme.css` is the third export.

## Rules

- Never import a game. GameKit only knows a game through each mode's `GameModule` contract.
- Components use only the theme tokens in `theme.css` (`ground`, `paper`, `ink`, `ink-soft`, `ink-faint`, `rule`, `slot`, `accent`, `on-accent`, `alert`), never raw colours, so every game's palette applies.
- Don't read `import.meta.env` here; games pass their Supabase settings in `GameConfig`.
- A change to a mode's database expectations needs a matching migration in that mode's template and in every game that bumps to the release.
- Release by bumping `version`, tagging `vX.Y.Z` and pushing the tag. Tags are never moved or reused.
