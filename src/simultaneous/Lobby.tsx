import { useState } from 'react'
import type { GameConfig } from '../core/config'
import type { PlayMode } from '../core/roomLink'
import { isModeAvailable, LobbyShell, PlayModeField } from '../core/screens'
import type { GameModule, TurnBasedState, TurnPlan } from './types'

type LobbyGame<Settings> = Pick<GameModule<Settings, TurnBasedState, TurnPlan>, 'defaultSettings' | 'SettingsForm'>

export function Lobby<Settings>({
  config,
  game,
  onCreateMatch,
}: {
  config: GameConfig
  game: LobbyGame<Settings>
  onCreateMatch: (settings: Settings, mode: PlayMode) => void
}) {
  const [settings, setSettings] = useState(game.defaultSettings)
  const [mode, setMode] = useState<PlayMode>('live')
  const { SettingsForm } = game

  return (
    <LobbyShell config={config} canCreate={isModeAvailable(config, mode)} onCreate={() => onCreateMatch(settings, mode)}>
      <SettingsForm settings={settings} onChange={setSettings} />
      <PlayModeField config={config} mode={mode} onChange={setMode} />
    </LobbyShell>
  )
}
