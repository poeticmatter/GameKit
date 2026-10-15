# GameKit

The multiplayer platform shared by the [game lab](https://poeticmatter.github.io/game-lab/)'s games: the lobby, room links, async play over Supabase, live play over PeerJS, hot seat, and the screens in between. A game supplies its rules and board; GameKit does the rest.

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
