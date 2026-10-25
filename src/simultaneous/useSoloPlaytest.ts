import { useCallback, useState } from 'react'
import type { GameRules, MatchConnection, PlayerSlot, TurnBasedState, TurnPlan } from './types'

/**
 * Solo playtest: one tester plays both players on this device, and nothing goes online.
 *
 * Turns stay simultaneous: the tester commits player 1's plan, then player 2's, and only
 * then is the turn resolved. A screen between every pair of plans says whose comes next,
 * so the tester never enters a plan for the wrong player.
 */

export interface SoloPlaytestProgress<State, Plan> {
  state: State
  p1Plan: Plan | null
  activeSlot: PlayerSlot
  isHandoffPending: boolean
}

export interface SoloPlaytestView<State, Plan> {
  connection: MatchConnection<State, Plan>
  /** The player whose plan comes next, or null while one is being planned. */
  pendingHandoff: PlayerSlot | null
  confirmHandoff: () => void
}

export function commitPlan<Settings, State extends TurnBasedState, Plan extends TurnPlan>(
  progress: SoloPlaytestProgress<State, Plan>,
  plan: Plan,
  rules: GameRules<Settings, State, Plan>,
): SoloPlaytestProgress<State, Plan> {
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

export function useSoloPlaytest<Settings, State extends TurnBasedState, Plan extends TurnPlan>(
  rules: GameRules<Settings, State, Plan>,
  settings: Settings,
): SoloPlaytestView<State, Plan> {
  const [progress, setProgress] = useState<SoloPlaytestProgress<State, Plan>>(() => ({
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
