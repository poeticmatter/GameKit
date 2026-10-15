import { useCallback, useState } from 'react'
import type { GameConfig } from '../core/config'
import { hostPeerId } from '../core/peer'
import { useHostLink, type LinkStatus } from '../core/useHostLink'
import type { PeerMessage } from './peerMessages'
import type { ConnectionStatus, MatchConnection, TurnBasedState, TurnPlan, UserRole } from './types'

/**
 * Live (PeerJS) transport for anyone who opens a room link. The host decides whether
 * this peer plays as player 2 or spectates. The guest never runs game rules: it only
 * sends its plan and applies whatever state the host broadcasts.
 */

function guestStatus(link: LinkStatus, errorMessage: string | null, assignedRole: UserRole | null): ConnectionStatus {
  if (errorMessage) return 'error'
  if (link === 'disconnected' || link === 'reconnecting') return link
  if (assignedRole === null) return 'connecting'
  return assignedRole === 'spectator' ? 'spectating' : 'playing'
}

export function usePeerGuest<State extends TurnBasedState, Plan extends TurnPlan>({
  config,
  roomCode,
}: {
  config: GameConfig
  roomCode: string
}): MatchConnection<State, Plan> {
  const [state, setState] = useState<State | null>(null)
  const [assignedRole, setAssignedRole] = useState<UserRole | null>(null)
  const [committedTurn, setCommittedTurn] = useState<number | null>(null)
  const [spectatorCount, setSpectatorCount] = useState(0)

  const link = useHostLink<PeerMessage<State, Plan>, PeerMessage<State, Plan>>(hostPeerId(config.id, roomCode), {
    onMessage: message => {
      if (message.type === 'ASSIGNED_ROLE') setAssignedRole(message.role)
      if (message.type === 'STATE') {
        setState(message.state)
        setSpectatorCount(message.spectatorCount)
      }
    },
  })
  const { send } = link
  const role = assignedRole ?? 'spectator'

  const submitPlan = useCallback(
    (plan: Plan) => {
      if (role === 'spectator') return
      if (send({ type: 'SUBMIT_PLAN', plan })) setCommittedTurn(plan.turn)
    },
    [role, send],
  )

  return {
    state,
    role,
    status: guestStatus(link.status, link.errorMessage, assignedRole),
    errorMessage: link.errorMessage,
    hasCommitted: state !== null && committedTurn === state.turn,
    spectatorCount,
    submitPlan,
  }
}
