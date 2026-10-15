import { useState } from 'react'
import { MAX_PLAYER_NAME_LENGTH, normalizePlayerName, recallPlayerName } from '../core/browserMemory'
import type { GameConfig } from '../core/config'
import { FieldLabel, SegmentedControl, TextInput } from '../core/controls'
import type { PlayMode } from '../core/roomLink'
import { isModeAvailable, LobbyShell, PlayModeField } from '../core/screens'
import type { GameModule } from './types'

export interface MatchRequest<Settings> {
  settings: Settings
  playerCount: number
  mode: PlayMode
  /** The creator's name; empty for hot seat. */
  hostName: string
}

type LobbyGame<Settings> = Pick<GameModule<Settings, unknown, unknown>, 'defaultSettings' | 'SettingsForm' | 'minPlayers' | 'maxPlayers'>

const DEFAULT_PLAYER_COUNT = 3

function playerCountOptions(min: number, max: number): number[] {
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
  const isOnline = mode !== 'hot_seat'
  const { SettingsForm } = game

  function create() {
    const hostName = isOnline ? normalizePlayerName(name) || 'Player 1' : ''
    onCreateMatch({ settings, playerCount, mode, hostName })
  }

  return (
    <LobbyShell config={config} canCreate={isModeAvailable(config, mode)} onCreate={create}>
      {game.minPlayers < game.maxPlayers && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Players</FieldLabel>
          <SegmentedControl<number>
            options={playerCountOptions(game.minPlayers, game.maxPlayers)}
            value={playerCount}
            onChange={setPlayerCount}
          />
        </div>
      )}
      <PlayModeField config={config} mode={mode} onChange={setMode} />
      {isOnline && (
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Your name</FieldLabel>
          <TextInput value={name} onChange={setName} placeholder="Player 1" maxLength={MAX_PLAYER_NAME_LENGTH} />
        </label>
      )}
      <SettingsForm settings={settings} playerCount={playerCount} onChange={setSettings} />
    </LobbyShell>
  )
}
