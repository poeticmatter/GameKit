import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { ASYNC_NOT_CONFIGURED_MESSAGE, type GameConfig } from './config'
import { describeError, matchTableOf } from './matchTable'

/**
 * Keeps one room's database row on screen for async play. The row is authoritative;
 * Realtime pushes changes, but delivery is best effort, so the hook also catches up when
 * the tab becomes visible and on a slow poll. Catching up never takes an older version
 * than the one shown, so it can't undo a local change that is still being written.
 */

const SAFETY_POLL_MS = 15_000

export interface RoomRowSource<Row> {
  config: GameConfig
  roomCode: string
  /** Loads the row, first creating it if this tab made the room. Throws if it can't be found. Must be stable. */
  openRow: () => Promise<Row>
  /** Loads the row as stored, or null if it's gone. Must be stable. */
  loadRow: () => Promise<Row | null>
  /** Which of two rows is newer. Must be stable. */
  versionOf: (row: Partial<Row>) => number | undefined
}

export interface RoomRow<Row> {
  row: Row | null
  /** The newest row, readable between renders (for example by a submit handler). */
  latestRow: RefObject<Row | null>
  errorMessage: string | null
  fail: (err: unknown) => void
  /** Shows a row at once, such as an optimistic local change. */
  showRow: (row: Row) => void
  /** Loads the row and shows it unless what's shown is newer. */
  catchUp: () => Promise<void>
  /** Loads the row and shows it whatever is shown; for after a refused write. */
  resync: () => Promise<void>
}

export function useRoomRow<Row extends object>({ config, roomCode, openRow, loadRow, versionOf }: RoomRowSource<Row>): RoomRow<Row> {
  const [row, setRow] = useState<Row | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const latestRow = useRef<Row | null>(null)

  const fail = useCallback((err: unknown) => setErrorMessage(describeError(err)), [])

  const showRow = useCallback((next: Row) => {
    latestRow.current = next
    setRow(next)
  }, [])

  /**
   * Merges rather than replaces, because Realtime may leave out large columns that
   * didn't change. Some writes keep the version (a player joining), so an equal version
   * is still news.
   */
  const mergeUnlessOlder = useCallback(
    (incoming: Partial<Row>, current: Row) => {
      const currentVersion = versionOf(current) ?? 0
      if ((versionOf(incoming) ?? currentVersion) < currentVersion) return
      showRow({ ...current, ...incoming })
    },
    [versionOf, showRow],
  )

  const catchUp = useCallback(async () => {
    const fresh = await loadRow()
    if (!fresh) return
    if (latestRow.current) mergeUnlessOlder(fresh, latestRow.current)
    else showRow(fresh)
  }, [loadRow, mergeUnlessOlder, showRow])

  const resync = useCallback(async () => {
    const fresh = await loadRow()
    if (fresh) showRow(fresh)
  }, [loadRow, showRow])

  useEffect(() => {
    if (!config.supabase) {
      setErrorMessage(ASYNC_NOT_CONFIGURED_MESSAGE)
      return
    }
    const table = matchTableOf(config)

    let isCancelled = false
    const failUnlessCancelled = (err: unknown) => !isCancelled && fail(err)
    const catchUpQuietly = () => !isCancelled && catchUp().catch(failUnlessCancelled)

    // Subscribe before loading so no update between the two is missed.
    const channel = table.client
      .channel(`${table.name}:${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: table.name, filter: `id=eq.${roomCode}` }, payload => {
        if (isCancelled) return
        // An update that beats the first load: load again so it isn't lost.
        if (!latestRow.current) return void catchUpQuietly()
        // Realtime payloads are untyped; this table's rows are only written by the kit.
        mergeUnlessOlder(payload.new as Partial<Row>, latestRow.current)
      })
      // After a dropped connection, catch up on anything missed while away.
      .subscribe(status => status === 'SUBSCRIBED' && latestRow.current && catchUpQuietly())

    openRow()
      .then(opened => !isCancelled && showRow(opened))
      .catch(failUnlessCancelled)

    // Phones suspend background tabs; refresh when the player comes back.
    const catchUpWhenVisible = () => document.visibilityState === 'visible' && catchUpQuietly()
    document.addEventListener('visibilitychange', catchUpWhenVisible)
    const safetyPoll = setInterval(catchUpWhenVisible, SAFETY_POLL_MS)

    return () => {
      isCancelled = true
      clearInterval(safetyPoll)
      document.removeEventListener('visibilitychange', catchUpWhenVisible)
      table.client.removeChannel(channel)
    }
  }, [config, roomCode, openRow, fail, catchUp, mergeUnlessOlder, showRow])

  return { row, latestRow, errorMessage, fail, showRow, catchUp, resync }
}
