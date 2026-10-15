import { useCallback, useRef, useState } from 'react'
import type { DataConnection } from 'peerjs'
import type { GameConfig } from '../core/config'
import { hostPeerId } from '../core/peer'
import { sendToGuest, useHostPeer } from '../core/useHostPeer'
import type { PeerMessage } from './peerMessages'
import type { ConnectionStatus, GameRules, MatchConnection, TurnBasedState, TurnPlan } from './types'

/**
 * Live (PeerJS) transport for the player who created the room. The host is always
 * player 1 and is the only peer that runs game rules.
 *
 * Commit-and-hold: the host's own plan is held locally until the guest's plan arrives,
 * so the host never sees the guest's move before committing its own and has no
 * information advantage. Only then does it resolve the turn and broadcast the result.
 */

interface HostConnections<State, Plan> {
  state: State
  guest: DataConnection | null
  spectators: Set<DataConnection>
  hostPlan: Plan | null
  guestPlan: Plan | null
}

export interface PeerHostOptions<Settings, State extends TurnBasedState, Plan extends TurnPlan> {
  config: GameConfig
  roomCode: string
  rules: GameRules<Settings, State, Plan>
  settings: Settings
}

function hostStatus(errorMessage: string | null, isOpen: boolean, hasGuestJoined: boolean): ConnectionStatus {
  if (errorMessage) return 'error'
  if (!isOpen) return 'connecting'
  return hasGuestJoined ? 'playing' : 'waiting_for_partner'
}

export function usePeerHost<Settings, State extends TurnBasedState, Plan extends TurnPlan>({
  config,
  roomCode,
  rules,
  settings,
}: PeerHostOptions<Settings, State, Plan>): MatchConnection<State, Plan> {
  const [state, setState] = useState<State>(() => rules.createInitialState(settings))
  const [hasGuestJoined, setHasGuestJoined] = useState(false)
  const [committedTurn, setCommittedTurn] = useState<number | null>(null)
  const [spectatorCount, setSpectatorCount] = useState(0)

  // Peer callbacks outlive renders, so they read and write this ref, never React state.
  const live = useRef<HostConnections<State, Plan>>({ state, guest: null, spectators: new Set(), hostPlan: null, guestPlan: null })

  const broadcastState = useCallback(() => {
    const { guest, spectators } = live.current
    const message: PeerMessage<State, Plan> = { type: 'STATE', state: live.current.state, spectatorCount: spectators.size }
    for (const connection of [guest, ...spectators]) if (connection) sendToGuest(connection, message)
    setSpectatorCount(spectators.size)
  }, [])

  const resolveIfBothCommitted = useCallback(() => {
    const { state: current, hostPlan, guestPlan } = live.current
    if (!hostPlan || !guestPlan) return
    live.current.hostPlan = null
    live.current.guestPlan = null
    live.current.state = rules.resolveTurn(current, hostPlan, guestPlan)
    setState(live.current.state)
    broadcastState()
  }, [rules, broadcastState])

  const { isOpen, errorMessage } = useHostPeer<PeerMessage<State, Plan>>(hostPeerId(config.id, roomCode), {
    onGuestOpen: connection => {
      const isGuestSlotFree = !live.current.guest?.open
      if (isGuestSlotFree) {
        live.current.guest = connection
        setHasGuestJoined(true)
      } else {
        live.current.spectators.add(connection)
      }
      sendToGuest<PeerMessage<State, Plan>>(connection, { type: 'ASSIGNED_ROLE', role: isGuestSlotFree ? 2 : 'spectator' })
      broadcastState()
    },
    onGuestMessage: (connection, message) => {
      if (message.type !== 'SUBMIT_PLAN' || connection !== live.current.guest) return
      if (message.plan.turn !== live.current.state.turn) return
      live.current.guestPlan = message.plan
      resolveIfBothCommitted()
    },
    onGuestGone: connection => {
      if (live.current.guest === connection) live.current.guest = null
      live.current.spectators.delete(connection)
      broadcastState()
    },
  })

  const submitPlan = useCallback(
    (plan: Plan) => {
      if (plan.turn !== live.current.state.turn) return
      live.current.hostPlan = plan
      setCommittedTurn(plan.turn)
      resolveIfBothCommitted()
    },
    [resolveIfBothCommitted],
  )

  return {
    state,
    role: 1,
    status: hostStatus(errorMessage, isOpen, hasGuestJoined),
    errorMessage,
    hasCommitted: committedTurn === state.turn,
    spectatorCount,
    submitPlan,
  }
}
