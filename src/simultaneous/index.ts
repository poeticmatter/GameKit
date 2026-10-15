// game-kit/simultaneous: two players commit plans at the same time, then the turn
// resolves. A game provides a GameModule and renders
// <SimultaneousGameApp config={GAME_CONFIG} game={game} />.

export { SimultaneousGameApp } from './GameApp'
export type {
  BoardProps,
  GameModule,
  GameRules,
  PlayerSlot,
  SettingsFormProps,
  TurnBasedState,
  TurnPlan,
  UserRole,
} from './types'

export { supabaseFromEnv, type GameConfig } from '../core/config'
export { Button, Card, ColorSwatch, FieldLabel, SegmentedControl, TextInput } from '../core/controls'
export { nextIndex, nextRandom, type RandomDraw } from '../core/random'
export type { Seating } from '../core/roomLink'
