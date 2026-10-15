import { IllegalMoveError } from '../IllegalMoveError'
import type { GameRules, MatchSetup } from '../types'
import { dealNextTurn, playSoloMove, startSoloPlaytest, type SoloPlaytest } from './session'

// A tiny game for the playtest tests. The active player may add 1 to their tally as often
// as they like, then pass to the next seat. The seed picks who starts. The table is over
// once the tallies reach 3 between them; the most adds wins. Cheating is illegal.

export interface TallyState {
  adds: number[]
  activePlayer: number
}
export type TallyMove = 'add' | 'pass' | 'cheat'

export const FINAL_TOTAL = 3

const totalOf = (state: TallyState) => state.adds.reduce((total, adds) => total + adds, 0)

export const tallyRules: GameRules<null, TallyState, TallyMove> = {
  createInitialState: ({ playerCount, seed }) => ({ adds: new Array<number>(playerCount).fill(0), activePlayer: seed % playerCount }),
  activePlayer: state => (totalOf(state) >= FINAL_TOTAL ? null : state.activePlayer),
  applyMove: (state, move) => {
    if (move === 'cheat') throw new IllegalMoveError('No cheating')
    if (move === 'add') return { ...state, adds: state.adds.map((adds, seat) => (seat === state.activePlayer ? adds + 1 : adds)) }
    return { ...state, activePlayer: (state.activePlayer + 1) % state.adds.length }
  },
  outcome: state => {
    const most = Math.max(...state.adds)
    return { winners: state.adds.flatMap((adds, seat) => (adds === most ? [seat] : [])), scores: state.adds }
  },
}

/** Tables of three, each first seat set by its seed. */
export function tallySetups(firstSeats: number[]): MatchSetup<null>[] {
  return firstSeats.map(seed => ({ settings: null, playerCount: 3, seed }))
}

export function startTally(firstSeats: number[], strategyNote = ''): SoloPlaytest<TallyState> {
  return startSoloPlaytest(tallyRules, { setups: tallySetups(firstSeats), strategyNote, randomState: 7 })
}

/** Plays each move in turn, taking every deal offered in between. */
export function playThrough(session: SoloPlaytest<TallyState>, moves: TallyMove[]): SoloPlaytest<TallyState> {
  return moves.reduce((current, move) => playSoloMove(tallyRules, dealNextTurn(tallyRules, current), move), session)
}
