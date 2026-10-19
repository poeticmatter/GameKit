import { readStored, removeStored, writeStored } from '../../core/browserMemory'
import type { SoloPlaytest, SoloStage } from './session'

// The hot-seat playtest in progress is kept in localStorage, one per game, so a reload
// carries on where it left off. Game states go in as JSON, as they already do for async
// play.

// Version 2 added undo (`turnStates`) and dropped the screen between turns; version 3 added
// `undoFloor`, for moves that can't be undone.
const FORMAT_VERSION = 3

const STAGES: readonly SoloStage[] = ['playing', 'turn_over', 'table_over', 'summary']

const playtestKey = (gameId: string) => `${gameId}-playtest`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIndexBelow(value: unknown, limit: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < limit
}

function isSeatList(value: unknown, seatCount: number): boolean {
  return Array.isArray(value) && value.every(seat => isIndexBelow(seat, seatCount))
}

function isSavedTable(value: unknown, seatCount: number): boolean {
  return isRecord(value) && 'state' in value && isSeatList(value.turnOrder, seatCount) && Number.isInteger(value.turnCount)
}

function isSavedSession(value: unknown): value is SoloPlaytest<unknown> {
  if (!isRecord(value)) return false
  const { tables, tableIndex, turnStates, undoFloor, seatCount, looks, stage, dealCount, randomState, strategyNote } = value
  if (typeof seatCount !== 'number' || !Array.isArray(tables)) return false
  return (
    tables.length > 0 &&
    tables.every(table => isSavedTable(table, seatCount)) &&
    isIndexBelow(tableIndex, tables.length) &&
    Array.isArray(turnStates) &&
    turnStates.length > 0 &&
    isIndexBelow(undoFloor, turnStates.length) &&
    isSeatList(looks, seatCount) &&
    STAGES.some(known => known === stage) &&
    Number.isInteger(dealCount) &&
    Number.isInteger(randomState) &&
    typeof strategyNote === 'string'
  )
}

export function serializePlaytest<State>(session: SoloPlaytest<State>): string {
  return JSON.stringify({ version: FORMAT_VERSION, session })
}

/** The saved playtest, or null when there is none or it can't be read. */
export function parsePlaytest<State>(stored: string | null): SoloPlaytest<State> | null {
  if (stored === null) return null
  let saved: unknown
  try {
    saved = JSON.parse(stored)
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err
    console.warn('Ignored a saved playtest that is not valid JSON.', err)
    return null
  }
  if (!isRecord(saved) || saved.version !== FORMAT_VERSION || !isSavedSession(saved.session)) {
    console.warn('Ignored a saved playtest in a format this version of GameKit does not read.', saved)
    return null
  }
  // Only the game knows its state's shape. Like an async row, a saved state is trusted to
  // be what the game stored; a stale one is caught where it renders.
  return saved.session as SoloPlaytest<State>
}

export function loadPlaytest<State>(gameId: string): SoloPlaytest<State> | null {
  return parsePlaytest(readStored(playtestKey(gameId)))
}

export function savePlaytest<State>(gameId: string, session: SoloPlaytest<State>): void {
  writeStored(playtestKey(gameId), serializePlaytest(session))
}

export function forgetPlaytest(gameId: string): void {
  removeStored(playtestKey(gameId))
}
