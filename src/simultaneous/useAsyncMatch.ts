import { useCallback } from 'react'
import type { GameConfig } from '../core/config'
import { matchTableOf } from '../core/matchTable'
import { useRoomRow } from '../core/useRoomRow'
import { createMatch, loadMatch, markPlayer2Joined, submitPlan as submitPlanRemote, type MatchRow } from './asyncMatchApi'
import type { ConnectionStatus, GameRules, MatchConnection, PlayerSlot, TurnBasedState, TurnPlan } from './types'

/**
 * Async (Supabase) transport for simultaneous games. No browser has to stay online: the
 * authoritative state lives in the game's table (kept on screen by useRoomRow).
 */

export interface AsyncMatchOptions<Settings, State extends TurnBasedState, Plan extends TurnPlan> {
  config: GameConfig
  roomCode: string
  slot: PlayerSlot
  rules: GameRules<Settings, State, Plan>
  /** Only the tab that created the room has these. */
  settings: Settings | null
}

const turnOfRow = (row: { turn?: number }) => row.turn

export function deriveStatus(row: { p2_joined: boolean } | null, slot: PlayerSlot, errorMessage: string | null): ConnectionStatus {
  if (errorMessage) return 'error'
  if (!row) return 'connecting'
  if (slot === 1 && !row.p2_joined) return 'waiting_for_partner'
  return 'playing'
}

export function useAsyncMatch<Settings, State extends TurnBasedState, Plan extends TurnPlan>({
  config,
  roomCode,
  slot,
  rules,
  settings,
}: AsyncMatchOptions<Settings, State, Plan>): MatchConnection<State, Plan> {
  const loadRow = useCallback(() => loadMatch<Settings, State, Plan>(matchTableOf(config), roomCode), [config, roomCode])

  const openRow = useCallback(async () => {
    const table = matchTableOf(config)
    // Only the creating tab holds `settings`; everyone else (including a host reopening
    // the link) must find an existing row.
    let existing = await loadMatch<Settings, State, Plan>(table, roomCode)
    if (!existing && slot === 1 && settings !== null) {
      await createMatch(table, roomCode, rules, settings)
      existing = await loadMatch<Settings, State, Plan>(table, roomCode)
    }
    if (!existing) throw new Error('Game not found. Check the link.')
    if (slot === 2 && !existing.p2_joined) {
      await markPlayer2Joined(table, roomCode)
      return { ...existing, p2_joined: true }
    }
    return existing
  }, [config, roomCode, slot, rules, settings])

  const { row, latestRow, errorMessage, fail, showRow } = useRoomRow<MatchRow<Settings, State, Plan>>({
    config,
    roomCode,
    openRow,
    loadRow,
    versionOf: turnOfRow,
  })

  const submitPlan = useCallback(
    (plan: Plan) => {
      const current = latestRow.current
      if (!current) return
      const planColumn = slot === 1 ? 'p1_plan' : 'p2_plan'
      // Optimistic: show our commit now; the stored row follows.
      showRow({ ...current, [planColumn]: plan })
      submitPlanRemote(matchTableOf(config), roomCode, slot, plan, rules).catch(fail)
    },
    [config, roomCode, slot, rules, latestRow, showRow, fail],
  )

  const myPlan = row ? (slot === 1 ? row.p1_plan : row.p2_plan) : null

  return {
    state: row?.state ?? null,
    role: slot,
    status: deriveStatus(row, slot, errorMessage),
    errorMessage,
    // Plans are cleared on resolution, so a stored plan means "committed this turn",
    // which also survives a page reload.
    hasCommitted: myPlan !== null,
    spectatorCount: 0,
    submitPlan,
  }
}
