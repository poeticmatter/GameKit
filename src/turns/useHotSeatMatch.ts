import { useCallback, useMemo, useState } from 'react'
import { applyPlayerMove } from './moveValidation'
import type { GameRules, MatchConnection, MatchSetup, PlayerProfile } from './types'

/**
 * Hot-seat transport: everyone shares one device, and nothing goes online or survives
 * a reload. The role is always whoever's turn it is, so the device simply passes on.
 */
export function useHotSeatMatch<Settings, State, Move>(
  rules: GameRules<Settings, State, Move>,
  setup: MatchSetup<Settings>,
): MatchConnection<State, Move> {
  const [state, setState] = useState<State>(() => rules.createInitialState(setup))

  const submitMove = useCallback(
    (move: Move) =>
      setState(current => {
        const player = rules.activePlayer(current)
        if (player === null) return current
        return applyPlayerMove(rules, current, player, move) ?? current
      }),
    [rules],
  )

  const players = useMemo<PlayerProfile[]>(
    () => Array.from({ length: setup.playerCount }, (_, index) => ({ name: `Player ${index + 1}` })),
    [setup.playerCount],
  )

  return {
    state,
    role: rules.activePlayer(state) ?? 'spectator',
    players,
    playerCount: setup.playerCount,
    status: 'playing',
    errorMessage: null,
    seatChoice: null,
    submitMove,
  }
}
