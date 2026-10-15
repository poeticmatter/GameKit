import { useCallback, useMemo, useRef, useState } from 'react'
import type { GameConfig } from '../core/config'
import { hostPeerId } from '../core/peer'
import { useHostLink, type LinkStatus } from '../core/useHostLink'
import type { GuestMessage, HostMessage } from './peerMessages'
import { recallRole, rememberRole } from './seats'
import type { ConnectionStatus, MatchConnection, PlayerProfile, SeatChoice, UserRole } from './types'

/**
 * Live (PeerJS) transport for anyone who opens a room link. The guest never runs game
 * rules: it sends its moves and shows whatever state the host broadcasts.
 *
 * A browser that held a seat before asks for it back automatically, including after a
 * dropped connection; otherwise it waits for the person to take a seat or watch.
 */

interface Snapshot<State> {
  state: State
  version: number
  players: PlayerProfile[]
  playerCount: number
}

function guestStatus(link: LinkStatus, errorMessage: string | null, snapshot: Snapshot<unknown> | null, role: UserRole | null): ConnectionStatus {
  if (errorMessage) return 'error'
  if (link === 'disconnected' || link === 'reconnecting') return link
  if (!snapshot) return 'connecting'
  if (role === null) return 'choosing_seat'
  if (snapshot.players.length < snapshot.playerCount) return 'waiting_for_players'
  return role === 'spectator' ? 'spectating' : 'playing'
}

/** How a returning browser rejoins: by seat if it had one, otherwise as a spectator. */
function rejoinMessage(role: UserRole): GuestMessage<never> {
  return role === 'spectator' ? { type: 'WATCH' } : { type: 'RESUME_SEAT', seat: role }
}

export function usePeerGuest<State, Move>({ config, roomCode }: { config: GameConfig; roomCode: string }): MatchConnection<State, Move> {
  const [snapshot, setSnapshot] = useState<Snapshot<State> | null>(null)
  const [role, setRole] = useState<UserRole | null>(() => recallRole(config.id, roomCode))
  // Read by link callbacks, which outlive renders.
  const currentRole = useRef(role)
  const currentVersion = useRef<number | null>(null)

  const link = useHostLink<HostMessage<State>, GuestMessage<Move>>(hostPeerId(config.id, roomCode), {
    onMessage: message => {
      if (message.type === 'ROLE') {
        currentRole.current = message.role
        setRole(message.role)
        rememberRole(config.id, roomCode, message.role)
        return
      }
      currentVersion.current = message.version
      setSnapshot({ state: message.state, version: message.version, players: message.players, playerCount: message.playerCount })
    },
    onConnected: send => {
      if (currentRole.current !== null) send(rejoinMessage(currentRole.current))
    },
  })
  const { send } = link

  const seatChoice = useMemo<SeatChoice>(
    () => ({
      claimSeat: name => void send({ type: 'CLAIM_SEAT', name }),
      resumeSeat: seat => void send({ type: 'RESUME_SEAT', seat }),
      watch: () => void send({ type: 'WATCH' }),
    }),
    [send],
  )

  const submitMove = useCallback(
    (move: Move) => {
      if (typeof currentRole.current !== 'number' || currentVersion.current === null) return
      send({ type: 'MOVE', version: currentVersion.current, move })
    },
    [send],
  )

  const status = guestStatus(link.status, link.errorMessage, snapshot, role)
  return {
    state: snapshot?.state ?? null,
    role: role ?? 'spectator',
    players: snapshot?.players ?? [],
    playerCount: snapshot?.playerCount ?? null,
    status,
    errorMessage: link.errorMessage,
    seatChoice: status === 'choosing_seat' ? seatChoice : null,
    submitMove,
  }
}
