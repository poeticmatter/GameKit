import { useCallback, useRef, useState } from 'react'
import type { DataConnection } from 'peerjs'
import type { GameConfig } from '../core/config'
import { hostPeerId } from '../core/peer'
import { sendToGuest, useHostPeer } from '../core/useHostPeer'
import { applyPlayerMoves } from './moveValidation'
import type { GuestMessage, HostMessage } from './peerMessages'
import type { ConnectionStatus, GameRules, MatchConnection, NewMatch, PlayerIndex, PlayerProfile } from './types'

/**
 * Live (PeerJS) transport for the player who created the room. The host holds seat 0
 * and is the only peer that runs game rules: guests send their turns, the host applies
 * the ones from the active player and broadcasts the result.
 *
 * Everyone who connects gets a snapshot first, then takes a free seat, takes back a
 * seat they held before (after a reload or on another device), or watches.
 */

const HOST_SEAT = 0

interface Seat {
  name: string
  /** Null for the host, and for a guest who has dropped out. */
  connection: DataConnection | null
}

interface HostTable<State> {
  state: State
  version: number
  seats: Seat[]
  spectators: Set<DataConnection>
  /** Connected, but not yet seated or watching. */
  undecided: Set<DataConnection>
}

export interface PeerHostOptions<Settings, State, Move> {
  config: GameConfig
  roomCode: string
  rules: GameRules<Settings, State, Move>
  newMatch: NewMatch<Settings, State>
}

function profilesOf(seats: Seat[]): PlayerProfile[] {
  return seats.map((seat, index) => ({
    name: seat.name,
    isOnline: index === HOST_SEAT || Boolean(seat.connection?.open),
  }))
}

function snapshotOf<State>({ state, version, seats }: HostTable<State>, playerCount: number): HostMessage<State> {
  return { type: 'SNAPSHOT', state, version, players: profilesOf(seats), playerCount }
}

function seatOf(seats: Seat[], connection: DataConnection): PlayerIndex | null {
  const index = seats.findIndex(seat => seat.connection === connection)
  return index === -1 ? null : index
}

function hostStatus(host: { errorMessage: string | null; isOpen: boolean; seatsTaken: number; playerCount: number }): ConnectionStatus {
  if (host.errorMessage) return 'error'
  if (!host.isOpen) return 'connecting'
  return host.seatsTaken < host.playerCount ? 'waiting_for_players' : 'playing'
}

export function usePeerHost<Settings, State, Move>({
  config,
  roomCode,
  rules,
  newMatch,
}: PeerHostOptions<Settings, State, Move>): MatchConnection<State, Move> {
  const { playerCount } = newMatch.setup
  const [state, setState] = useState<State>(newMatch.initialState)
  const [players, setPlayers] = useState<PlayerProfile[]>([{ name: newMatch.hostName, isOnline: true }])

  // Peer callbacks outlive renders, so they read and write this ref, never React state.
  const table = useRef<HostTable<State>>({
    state: newMatch.initialState,
    version: 0,
    seats: [{ name: newMatch.hostName, connection: null }],
    spectators: new Set(),
    undecided: new Set(),
  })

  const broadcast = useCallback(() => {
    const { state: current, seats, spectators, undecided } = table.current
    const snapshot = snapshotOf(table.current, playerCount)
    const guests = [...seats.map(seat => seat.connection), ...spectators, ...undecided]
    for (const connection of guests) if (connection) sendToGuest(connection, snapshot)
    setState(current)
    setPlayers(profilesOf(seats))
  }, [playerCount])

  /** Returns false, leaving the table alone, if the player's moves aren't all legal. */
  const applyTurn = useCallback(
    (player: PlayerIndex, moves: Move[]) => {
      const nextState = applyPlayerMoves(rules, table.current.state, player, moves)
      if (nextState === null) return false
      table.current.state = nextState
      table.current.version += 1
      broadcast()
      return true
    },
    [rules, broadcast],
  )

  function assign(connection: DataConnection, role: PlayerIndex | 'spectator') {
    table.current.undecided.delete(connection)
    if (role === 'spectator') table.current.spectators.add(connection)
    sendToGuest<HostMessage<State>>(connection, { type: 'ROLE', role })
    broadcast()
  }

  function receive(connection: DataConnection, message: GuestMessage<Move>) {
    const { seats, version } = table.current
    if (message.type === 'TURN') {
      const seat = seatOf(seats, connection)
      if (seat === null) return
      const isApplied = message.version === version && applyTurn(seat, message.moves)
      // A guest that sent a stale or illegal turn is waiting for an answer: show it the table as it is.
      if (!isApplied) sendToGuest(connection, snapshotOf(table.current, playerCount))
      return
    }
    if (seatOf(seats, connection) !== null) return
    if (message.type === 'CLAIM_SEAT' && seats.length < playerCount) {
      seats.push({ name: message.name, connection })
      assign(connection, seats.length - 1)
    } else if (message.type === 'RESUME_SEAT' && message.seat !== HOST_SEAT && message.seat < seats.length) {
      // Knowing the room code is the only credential, so a returning player simply
      // takes the seat over, even if their old connection hasn't timed out yet.
      seats[message.seat].connection = connection
      assign(connection, message.seat)
    } else {
      assign(connection, 'spectator')
    }
  }

  const { isOpen, errorMessage } = useHostPeer<GuestMessage<Move>>(hostPeerId(config.id, roomCode), {
    onGuestOpen: connection => {
      table.current.undecided.add(connection)
      broadcast()
    },
    onGuestMessage: receive,
    onGuestGone: connection => {
      for (const seat of table.current.seats) if (seat.connection === connection) seat.connection = null
      table.current.spectators.delete(connection)
      table.current.undecided.delete(connection)
      broadcast()
    },
  })

  const submitMoves = useCallback((moves: Move[]) => void applyTurn(HOST_SEAT, moves), [applyTurn])

  return {
    state,
    role: HOST_SEAT,
    players,
    playerCount,
    status: hostStatus({ errorMessage, isOpen, seatsTaken: players.length, playerCount }),
    errorMessage,
    seatChoice: null,
    submitMoves,
  }
}
