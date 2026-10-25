import { useCallback, useState } from 'react'
import type { GameConfig } from '../core/config'
import { buildRoomUrl, generateRoomCode, readRoomLinkFromUrl, type PlayMode, type RoomLink, type Seating } from '../core/roomLink'
import { ProgressScreen, StatusScreen } from '../core/screens'
import { Lobby } from './Lobby'
import { recallSlot, rememberRoomCreator } from './roles'
import { HandoffScreen, WaitingForPartnerScreen } from './screens'
import type { GameModule, MatchConnection, TurnBasedState, TurnPlan } from './types'
import { useAsyncMatch } from './useAsyncMatch'
import { usePeerGuest } from './usePeerGuest'
import { usePeerHost } from './usePeerHost'
import { useSoloPlaytest } from './useSoloPlaytest'

/**
 * A whole simultaneous two-player game app: the lobby, then a match over whichever
 * transport was chosen, ending at the game's own Board. Routes on the URL
 * (`?room=CODE[&mode=async]`); solo playtests have no URL.
 */

interface AppProps<Settings, State extends TurnBasedState, Plan extends TurnPlan> {
  config: GameConfig
  game: GameModule<Settings, State, Plan>
}

interface RoomProps<Settings, State extends TurnBasedState, Plan extends TurnPlan> extends AppProps<Settings, State, Plan> {
  room: RoomLink
}

function GameBoard<Settings, State extends TurnBasedState, Plan extends TurnPlan>({
  game,
  state,
  connection,
  seating,
}: {
  game: GameModule<Settings, State, Plan>
  state: State
  connection: MatchConnection<State, Plan>
  seating: Seating
}) {
  return (
    <game.Board
      state={state}
      role={connection.role}
      hasCommitted={connection.hasCommitted}
      onSubmitPlan={connection.submitPlan}
      seating={seating}
    />
  )
}

/** Maps any online transport's connection to the right screen, ending at the Board. */
function MatchScreen<Settings, State extends TurnBasedState, Plan extends TurnPlan>({
  game,
  room,
  connection,
}: RoomProps<Settings, State, Plan> & { connection: MatchConnection<State, Plan> }) {
  const { state, status, errorMessage } = connection

  if (status === 'error') return <StatusScreen message={errorMessage ?? 'Connection error.'} />
  if (status === 'disconnected') return <StatusScreen message="Lost connection to the host." />
  if (status === 'reconnecting') return <ProgressScreen title="Connection lost" detail="Reconnecting…" />
  if (status === 'waiting_for_partner') return <WaitingForPartnerScreen room={room} />
  if (!state) return <ProgressScreen title="Connecting…" />

  return <GameBoard game={game} state={state} connection={connection} seating="remote" />
}

function LiveHostMatch<Settings, State extends TurnBasedState, Plan extends TurnPlan>(
  props: RoomProps<Settings, State, Plan> & { settings: Settings },
) {
  const { config, game, room, settings } = props
  const connection = usePeerHost({ config, roomCode: room.code, rules: game.rules, settings })
  return <MatchScreen {...props} connection={connection} />
}

function LiveGuestMatch<Settings, State extends TurnBasedState, Plan extends TurnPlan>(props: RoomProps<Settings, State, Plan>) {
  const connection = usePeerGuest<State, Plan>({ config: props.config, roomCode: props.room.code })
  return <MatchScreen {...props} connection={connection} />
}

function AsyncMatch<Settings, State extends TurnBasedState, Plan extends TurnPlan>(
  props: RoomProps<Settings, State, Plan> & { settings: Settings | null },
) {
  const { config, game, room, settings } = props
  // Read once: a player's slot must not change mid-game, even if storage does.
  const [slot] = useState(() => recallSlot(config.id, room.code))
  const connection = useAsyncMatch({ config, roomCode: room.code, slot, rules: game.rules, settings })
  return <MatchScreen {...props} connection={connection} />
}

function SoloPlaytestMatch<Settings, State extends TurnBasedState, Plan extends TurnPlan>({
  game,
  settings,
}: {
  game: GameModule<Settings, State, Plan>
  settings: Settings
}) {
  const { connection, pendingHandoff, confirmHandoff } = useSoloPlaytest(game.rules, settings)
  if (pendingHandoff !== null) return <HandoffScreen slot={pendingHandoff} onReady={confirmHandoff} />
  if (!connection.state) return <ProgressScreen title="Starting…" />

  // Remount per player so one player's in-progress UI selection never carries over to the other.
  return (
    <GameBoard
      key={`${connection.state.turn}-${connection.role}`}
      game={game}
      state={connection.state}
      connection={connection}
      seating="solo_playtest"
    />
  )
}

interface ActiveRoom<Settings> {
  link: RoomLink
  /** Present only in the tab that created the room. */
  settings: Settings | null
}

export function SimultaneousGameApp<Settings, State extends TurnBasedState, Plan extends TurnPlan>({
  config,
  game,
}: AppProps<Settings, State, Plan>) {
  const [room, setRoom] = useState<ActiveRoom<Settings> | null>(() => {
    const link = readRoomLinkFromUrl()
    return link ? { link, settings: null } : null
  })
  // Solo playtests live only in memory: they have no room and no URL to share or resume.
  const [playtestSettings, setPlaytestSettings] = useState<Settings | null>(null)

  const createMatch = useCallback(
    (settings: Settings, mode: PlayMode) => {
      // The Create button sits at the bottom of the lobby; start the match at the top.
      window.scrollTo(0, 0)
      if (mode === 'solo_playtest') {
        setPlaytestSettings(settings)
        return
      }
      const link: RoomLink = { code: generateRoomCode(), transport: mode }
      rememberRoomCreator(config.id, link.code)
      history.replaceState(null, '', buildRoomUrl(link))
      setRoom({ link, settings })
    },
    [config.id],
  )

  if (playtestSettings !== null) return <SoloPlaytestMatch game={game} settings={playtestSettings} />
  if (!room) return <Lobby config={config} game={game} onCreateMatch={createMatch} />

  const roomProps = { config, game, room: room.link }
  if (room.link.transport === 'async') return <AsyncMatch {...roomProps} settings={room.settings} />
  if (room.settings !== null) return <LiveHostMatch {...roomProps} settings={room.settings} />
  return <LiveGuestMatch {...roomProps} />
}
