// game-kit/turns: 2–N players taking turns in order. A game provides a GameModule and
// renders <TurnBasedGameApp config={GAME_CONFIG} game={game} />.

export { TurnBasedGameApp } from './GameApp'
export { IllegalMoveError } from './IllegalMoveError'
export type {
  BoardProps,
  GameModule,
  GameRules,
  MatchSetup,
  PlayerAppearance,
  PlayerIndex,
  PlayerProfile,
  SettingsFormProps,
  UserRole,
} from './types'

export { supabaseFromEnv, type GameConfig } from '../core/config'
export { Button, Card, ColorSwatch, FieldLabel, SegmentedControl, TextInput } from '../core/controls'
export { nextIndex, nextRandom, type RandomDraw } from '../core/random'
export type { Seating } from '../core/roomLink'
