import { useCallback, useEffect, useMemo, useState } from 'react'
import { confirmIrreversible, irreversibleReasonOf } from '../irreversible'
import type { GameModule, PlayerIndex, PlayerProfile, UserRole } from '../types'
import {
  canShowSummary,
  canUndo,
  dealNextTurn,
  dealtSeatOf,
  endSoloTurn,
  openTableCountOf,
  playSoloMove,
  showSummary,
  stateOnScreen,
  undoSoloMove,
  type SoloPlaytest,
  type SoloStage,
} from './session'
import { savePlaytest } from './storage'
import { summarizePlaytest, type PlaytestSummary } from './summary'

export interface SoloPlaytestView<State, Move> {
  stage: SoloStage
  /** The table on screen. */
  state: State
  role: UserRole
  /** Named after the look each seat wears, so names never give a seat away. */
  players: PlayerProfile[]
  lookOf: (seat: PlayerIndex) => PlayerIndex
  dealCount: number
  openTableCount: number
  strategyNote: string
  /** Non-null only while the stage is 'summary'. */
  summary: PlaytestSummary | null
  canUndo: boolean
  /** False once a move has been made this deal: the summary waits for the turn to end. */
  canShowSummary: boolean
  submitMove: (move: Move) => void
  undoMove: () => void
  endTurn: () => void
  dealNextTurn: () => void
  showSummary: () => void
}

interface SoloPlaytestOptions<Settings, State, Move> {
  game: Pick<GameModule<Settings, State, Move>, 'rules' | 'playerAppearance'>
  gameId: string
  initialSession: SoloPlaytest<State>
}

/** Runs a solo playtest, saving it after every change so a reload resumes it. */
export function useSoloPlaytest<Settings, State, Move>({
  game: { rules, playerAppearance },
  gameId,
  initialSession,
}: SoloPlaytestOptions<Settings, State, Move>): SoloPlaytestView<State, Move> {
  const [session, setSession] = useState(initialSession)

  useEffect(() => savePlaytest(gameId, session), [gameId, session])

  const submitMove = useCallback(
    (move: Move) => {
      // Ask before a move that can't be undone, so the tester can think again.
      if (session.stage === 'playing') {
        const reason = irreversibleReasonOf(rules, stateOnScreen(session), move)
        if (reason !== null && !confirmIrreversible(reason)) return
      }
      setSession(current => playSoloMove(rules, current, move))
    },
    [rules, session],
  )
  const undo = useCallback(() => setSession(undoSoloMove), [])
  const endTurn = useCallback(() => setSession(current => endSoloTurn(rules, current)), [rules])
  const deal = useCallback(() => setSession(current => dealNextTurn(rules, current)), [rules])
  const summarize = useCallback(() => setSession(showSummary), [])

  const { looks } = session
  // Seats beyond the table aren't in play, so they keep their own look.
  const lookOf = useCallback((seat: PlayerIndex) => looks[seat] ?? seat, [looks])
  const players = useMemo(() => looks.map(look => ({ name: playerAppearance(look).name })), [looks, playerAppearance])
  const summary = useMemo(() => (session.stage === 'summary' ? summarizePlaytest(rules, session) : null), [rules, session])

  const dealtSeat = dealtSeatOf(rules, session)
  return {
    stage: session.stage,
    state: stateOnScreen(session),
    role: dealtSeat ?? 'spectator',
    players,
    lookOf,
    dealCount: session.dealCount,
    openTableCount: openTableCountOf(rules, session),
    strategyNote: session.strategyNote,
    summary,
    canUndo: canUndo(session),
    canShowSummary: canShowSummary(session),
    submitMove,
    undoMove: undo,
    endTurn,
    dealNextTurn: deal,
    showSummary: summarize,
  }
}
