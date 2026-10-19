import { useCallback, useMemo, useRef, useState } from 'react'
import type { GameConfig } from '../core/config'
import { matchTableOf } from '../core/matchTable'
import { useRoomRow } from '../core/useRoomRow'
import { claimSeat, createMatch, loadMatch, saveMove, type MatchRow } from './asyncMatchApi'
import { applyPlayerMoves } from './moveValidation'
import { recallRole, rememberRole } from './seats'
import type { ConnectionStatus, GameRules, MatchConnection, NewMatch, PlayerIndex, SeatChoice, UserRole } from './types'

/**
 * Async (Supabase) transport for turn-based games. No browser has to stay online: the
 * authoritative state lives in the game's table (kept on screen by useRoomRow).
 *
 * The active player's client applies their turn locally, shows it at once, and queues
 * the write. Writes go out one at a time, each guarded on the version it was computed
 * from; if one is refused, the row is reloaded and the board snaps to what's stored.
 */

export interface AsyncMatchOptions<Settings, State, Move> {
  config: GameConfig
  roomCode: string
  rules: GameRules<Settings, State, Move>
  /** Only the tab that created the room has this. */
  newMatch: NewMatch<Settings, State> | null
}

const versionOfRow = (row: { version?: number }) => row.version

/** A remembered seat only counts if the room actually has that seat filled. */
export function validRole(role: UserRole | null, playersSeated: number): UserRole | null {
  if (role === 'spectator') return role
  return role !== null && role < playersSeated ? role : null
}

export function deriveStatus(
  row: { players: unknown[]; player_count: number } | null,
  role: UserRole | null,
  errorMessage: string | null,
): ConnectionStatus {
  if (errorMessage) return 'error'
  if (!row) return 'connecting'
  if (role === null) return 'choosing_seat'
  if (row.players.length < row.player_count) return 'waiting_for_players'
  return role === 'spectator' ? 'spectating' : 'playing'
}

export function useAsyncMatch<Settings, State, Move>({
  config,
  roomCode,
  rules,
  newMatch,
}: AsyncMatchOptions<Settings, State, Move>): MatchConnection<State, Move> {
  const [storedRole, setStoredRole] = useState<UserRole | null>(() => recallRole(config.id, roomCode))
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  const loadRow = useCallback(() => loadMatch<Settings, State>(matchTableOf(config), roomCode), [config, roomCode])

  const openRow = useCallback(async () => {
    const table = matchTableOf(config)
    const existing = await loadMatch<Settings, State>(table, roomCode)
    if (existing) return existing
    if (!newMatch) throw new Error('Game not found. Check the link.')
    await createMatch(table, roomCode, newMatch)
    const created = await loadMatch<Settings, State>(table, roomCode)
    if (!created) throw new Error(`Room ${roomCode} was created but can't be read back.`)
    return created
  }, [config, roomCode, newMatch])

  const { row, latestRow, errorMessage, fail, showRow, catchUp, resync } = useRoomRow<MatchRow<Settings, State>>({
    config,
    roomCode,
    openRow,
    loadRow,
    versionOf: versionOfRow,
  })

  const role = row ? validRole(storedRole, row.players.length) : storedRole

  const chooseRole = useCallback(
    (chosen: UserRole) => {
      rememberRole(config.id, roomCode, chosen)
      setStoredRole(chosen)
    },
    [config.id, roomCode],
  )

  const seatChoice = useMemo<SeatChoice>(
    () => ({
      claimSeat: name => {
        claimSeat(matchTableOf(config), roomCode, name)
          .then(async seat => {
            // Load the new seat list first, so the seat is valid the moment it's chosen.
            await catchUp()
            // The last seat went to someone else first; watch instead.
            chooseRole(seat ?? 'spectator')
          })
          .catch(fail)
      },
      resumeSeat: (index: PlayerIndex) => chooseRole(index),
      watch: () => chooseRole('spectator'),
    }),
    [config, roomCode, chooseRole, catchUp, fail],
  )

  const submitMoves = useCallback(
    (moves: Move[]) => {
      const current = latestRow.current
      if (!current || typeof role !== 'number') return
      const nextState = applyPlayerMoves(rules, current.state, role, moves)
      if (nextState === null) return

      const fromVersion = current.version
      showRow({ ...current, state: nextState, version: fromVersion + 1 })
      writeQueue.current = writeQueue.current
        .then(async () => {
          if (await saveMove(matchTableOf(config), roomCode, fromVersion, nextState)) return
          console.warn(`Turn on version ${fromVersion} of room ${roomCode} was refused as stale; reloading.`)
          await resync()
        })
        .catch(fail)
    },
    [config, roomCode, rules, role, latestRow, showRow, resync, fail],
  )

  const status = deriveStatus(row, role, errorMessage)
  return {
    state: row?.state ?? null,
    role: role ?? 'spectator',
    players: row?.players ?? [],
    playerCount: row?.player_count ?? null,
    status,
    errorMessage,
    seatChoice: status === 'choosing_seat' ? seatChoice : null,
    submitMoves,
  }
}
