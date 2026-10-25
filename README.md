# GameKit

The multiplayer platform shared by the [game lab](https://poeticmatter.github.io/game-lab/)'s games: the lobby, room links, async play over Supabase, live play over PeerJS, a solo playtest on one device, and the screens in between. A game supplies its rules and board; GameKit does the rest.

Two kinds of game, two entry points:

| Entry point | For | Template |
|---|---|---|
| `game-kit/simultaneous` | Two players choose secretly at the same time, then the turn resolves | [game-template](https://github.com/poeticmatter/game-template) |
| `game-kit/turns` | 2–N players take turns in order; a turn can take several moves | [game-template-turns](https://github.com/poeticmatter/game-template-turns) |

Start new games from a template rather than wiring GameKit by hand.

## Using it

GameKit ships TypeScript source and is installed from a release tag:

```json
"dependencies": {
  "game-kit": "github:poeticmatter/GameKit#v0.1.0"
}
```

Bumping the tag is a deliberate choice per game; nothing updates on its own.

```tsx
// src/game.config.ts
import { supabaseFromEnv, type GameConfig } from 'game-kit/turns'
export const GAME_CONFIG: GameConfig = {
  id: 'townhall',               // unique in the lab: names the Supabase table, prefixes room ids and storage keys
  title: 'Town Hall',
  tagline: 'One line for the lobby.',
  supabase: supabaseFromEnv(import.meta.env),
}

// src/App.tsx
import { TurnBasedGameApp } from 'game-kit/turns'
export default () => <TurnBasedGameApp config={GAME_CONFIG} game={game} />
```

```css
/* src/index.css */
@import "tailwindcss";
@import "game-kit/theme.css";   /* colour tokens, base styles, and @source for the kit's classes */
@theme { --color-accent: #0072b2; }   /* override any token */
```

Because the kit is TypeScript source, a game's `vite.config.ts` sends it through the normal transforms (the templates already do this):

```ts
optimizeDeps: { exclude: ['game-kit'], include: ['peerjs', '@supabase/supabase-js'] },
test: { server: { deps: { inline: ['game-kit'] } } },   // with defineConfig from 'vitest/config'
```

The Supabase table each mode expects is defined by the matching template's `supabase/migrations/`.

## Solo playtest

The lobby's third play mode, **Solo Playtest** (`'solo_playtest'`, both as the `PlayMode` and as the `Seating` a board gets), is one tester playing every seat on one device. In simultaneous games the tester enters both players' plans, with a screen between them naming whose comes next. Turn-based games go further, so the tester can't carry a plan from one turn to the next:

- The lobby asks for 1–4 **tables**: separate games with the same settings and player count, each with its own seed.
- When the dealt seat's turn has passed, the tester presses **End turn** and is dealt straight into a random unfinished table, sometimes the same one again. Until then **Undo** takes back the turn's moves one at a time, except moves that can't be undone (see below).
- The seat being played always looks like seat 0, and the other seats' looks are shuffled, so the tester is the same colour every turn. A finished table shows its real seats.
- An optional **strategy** note, written in the lobby, is shown above every table: one way of playing (a personality) to apply to every seat.
- The **summary**, open above the board before the turn's first move and offered when a table ends, repeats the strategy and lists each table's seats in the order they first took a turn, with scores and winners. Across finished tables it counts wins by turn position, which shows a first-player advantage even when the game picks the first player at random.
- The playtest is saved in the browser after every change, so a reload carries on. Ending it from the summary, or quitting it at any point (Quit sits above every table and asks first), discards it and returns to the lobby. If a saved playtest no longer works after the game's code changes, the kit offers to discard it.

Winners and scores come from the optional `GameRules.outcome(state)`, called only once `activePlayer` is null; without it the summary still shows turn order. Game states are saved as JSON, which they already must be for async play.

A board takes part through `BoardProps.lookOf`: draw every seat-coloured thing (pieces, swatches, colour names) with `lookOf(seat)` instead of `seat`, and take names from `players`, which the solo playtest names after each seat's look. Online, `lookOf(seat)` is just `seat`. Anything else ordered by seat, such as a scoreboard in seat order, still gives the seat away; list players starting from the viewer's seat instead.

## Undo and End turn

The solo playtest, async and live play all take a turn the same way. The player's moves stay on their own screen, where **Undo** takes them back one at a time, until play has passed to someone else and they press **End turn**. Then the whole turn is sent at once: one write to the database in async play, one message to the host in live play. Everyone else keeps seeing the state as it was after the last turn that was sent. A draft is kept only in memory, so a reload during a turn drops the moves not yet sent.

A game can mark moves that can't be undone, by drawing at random for example: if a player could see the draw, undo and choose differently, they would be peeking, and a seeded draw would just come out the same when replayed. Give `GameRules` the optional

```ts
irreversibleReason(state, move): string | null
```

and return a message for such a move. Before playing it the kit pauses the game with a warning that shows the message, and if the player goes ahead it sends the turn so far at once, so nothing before the move can be undone, even by reloading. For a move the rules reject it can throw `IllegalMoveError` or return null. The solo playtest asks and counts the move the same way.

Transports submit a whole turn with `MatchConnection.submitMoves(moves)`, which applies the moves in order, or none of them if one is refused. Live guests send a `TURN` message carrying the version it was made on; a host that refuses it sends the guest a snapshot so it catches up.

## Developing

```bash
npm install
npm run lint     # tsc --noEmit (strict)
npm test         # vitest
```

To try a change in a game before releasing, pack it and install the tarball there (`npm link` would give the game two copies of React):

```bash
npm pack                                  # writes game-kit-<version>.tgz
cd ../SomeGame && npm install ../GameKit/game-kit-<version>.tgz
```

## Releasing

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag v0.2.0 && git push origin main v0.2.0`.
3. In each game that should get it, set `"game-kit": "github:poeticmatter/GameKit#v0.2.0"`, run `npm install`, then lint, test and build.
