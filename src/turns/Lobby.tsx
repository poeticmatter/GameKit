import { useState } from 'react'
import { MAX_PLAYER_NAME_LENGTH, normalizePlayerName, recallPlayerName } from '../core/browserMemory'
import type { GameConfig } from '../core/config'
import { FieldLabel, SegmentedControl, TextArea, TextInput } from '../core/controls'
import type { PlayMode } from '../core/roomLink'
import { isModeAvailable, LobbyShell, PlayModeField } from '../core/screens'
import type { GameModule } from './types'

export interface MatchRequest<Settings> {
  settings: Settings
  playerCount: number
  mode: PlayMode
  /** The creator's name; empty for hot seat. */
  hostName: string
  /** Hot seat only: how many tables of the game to deal turns from. */
  tableCount: number
  /** Hot seat only: how the tester means to play every seat; may be empty. */
  strategyNote: string
}

type LobbyGame<Settings> = Pick<GameModule<Settings, unknown, unknown>, 'defaultSettings' | 'SettingsForm' | 'minPlayers' | 'maxPlayers'>

const DEFAULT_PLAYER_COUNT = 3
const DEFAULT_TABLE_COUNT = 2
const MAX_TABLE_COUNT = 4
const MAX_STRATEGY_NOTE_LENGTH = 500

function countOptions(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, offset) => min + offset)
}

export function Lobby<Settings>({
  config,
  game,
  onCreateMatch,
}: {
  config: GameConfig
  game: LobbyGame<Settings>
  onCreateMatch: (request: MatchRequest<Settings>) => void
}) {
  const [settings, setSettings] = useState(game.defaultSettings)
  const [playerCount, setPlayerCount] = useState(Math.min(Math.max(DEFAULT_PLAYER_COUNT, game.minPlayers), game.maxPlayers))
  const [mode, setMode] = useState<PlayMode>('async')
  const [name, setName] = useState(() => recallPlayerName(config.id))
  const [tableCount, setTableCount] = useState(DEFAULT_TABLE_COUNT)
  const [strategyNote, setStrategyNote] = useState('')
  const isOnline = mode !== 'hot_seat'
  const { SettingsForm } = game

  function create() {
    const hostName = isOnline ? normalizePlayerName(name) || 'Player 1' : ''
    onCreateMatch({ settings, playerCount, mode, hostName, tableCount, strategyNote: strategyNote.trim() })
  }

  return (
    <LobbyShell config={config} canCreate={isModeAvailable(config, mode)} onCreate={create}>
      {game.minPlayers < game.maxPlayers && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Players</FieldLabel>
          <SegmentedControl<number>
            options={countOptions(game.minPlayers, game.maxPlayers)}
            value={playerCount}
            onChange={setPlayerCount}
          />
        </div>
      )}
      <PlayModeField config={config} mode={mode} onChange={setMode} />
      {isOnline ? (
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Your name</FieldLabel>
          <TextInput value={name} onChange={setName} placeholder="Player 1" maxLength={MAX_PLAYER_NAME_LENGTH} />
        </label>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Tables</FieldLabel>
            <SegmentedControl<number> options={countOptions(1, MAX_TABLE_COUNT)} value={tableCount} onChange={setTableCount} />
            <p className="text-xs leading-relaxed text-ink-soft">
              You play every seat. After each turn you’re dealt into a random table, sometimes the same one again, always as
              the first player’s colour; the other colours are shuffled.
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>Strategy</FieldLabel>
            <TextArea
              value={strategyNote}
              onChange={setStrategyNote}
              placeholder="How will you play every seat? e.g. Greedy: always take the most points now."
              maxLength={MAX_STRATEGY_NOTE_LENGTH}
            />
            <p className="text-xs leading-relaxed text-ink-soft">Shown before every turn and in the summary.</p>
          </label>
        </>
      )}
      <SettingsForm settings={settings} playerCount={playerCount} onChange={setSettings} />
    </LobbyShell>
  )
}
