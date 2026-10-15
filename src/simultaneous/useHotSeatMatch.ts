import { useCallback, useState } from 'react'
import type { GameRules, MatchConnection, PlayerSlot, TurnBasedState, TurnPlan } from './types'

/**
 * Hot-seat transport: both players share one device, and nothing goes online.
 *
 * Turns stay simultaneous: player 1 commits, the device is handed to player 2, player 2
 * commits, and only then is the turn resolved. A handoff screen sits between every pair
 * of inputs so that neither player sees the other's private view.
 */

export interface HotSeatProgress<State, Plan> {
  state: State
  p1Plan: Plan | null
  activeSlot: PlayerSlot
  isHandoffPending: boolean
}

export interface HotSeatMatch<State, Plan> {
  connection: MatchConnection<State, Plan>
  /** The player who must take the device next, or null while a player is at the board. */
  pendingHandoff: PlayerSlot | null
  confirmHandoff: () => void
}

export function commitPlan<Settings, State extends TurnBasedState, Plan extends TurnPlan>(
  progress: HotSeatProgress<State, Plan>,
  plan: Plan,
  rules: GameRules<Settings, State, Plan>,
): HotSeatProgress<State, Plan> {
  if (plan.turn !== progress.state.turn || progress.isHandoffPending) return progress

  if (progress.activeSlot === 1) {
    return { ...progress, p1Plan: plan, activeSlot: 2, isHandoffPending: true }
  }
  if (!progress.p1Plan) return progress

  return {
    state: rules.resolveTurn(progress.state, progress.p1Plan, plan),
    p1Plan: null,
    activeSlot: 1,
    isHandoffPending: true,
  }
}

export function useHotSeatMatch<Settings, State extends TurnBasedState, Plan extends TurnPlan>(
  rules: GameRules<Settings, State, Plan>,
  settings: Settings,
): HotSeatMatch<State, Plan> {
  const [progress, setProgress] = useState<HotSeatProgress<State, Plan>>(() => ({
    state: rules.createInitialState(settings),
    p1Plan: null,
    activeSlot: 1,
    isHandoffPending: false,
  }))

  const submitPlan = useCallback((plan: Plan) => setProgress(current => commitPlan(current, plan, rules)), [rules])

  const confirmHandoff = useCallback(() => setProgress(current => ({ ...current, isHandoffPending: false })), [])

  return {
    connection: {
      state: progress.state,
      role: progress.activeSlot,
      status: 'playing',
      errorMessage: null,
      hasCommitted: false,
      spectatorCount: 0,
      submitPlan,
    },
    pendingHandoff: progress.isHandoffPending ? progress.activeSlot : null,
    confirmHandoff,
  }
}
