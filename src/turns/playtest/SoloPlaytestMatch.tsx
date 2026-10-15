import { returnToLobby } from '../../core/screens'
import { PLAYED_SEAT_LOOK } from '../../core/seatDisguise'
import type { GameModule } from '../types'
import { NextTurnScreen, PlaytestErrorBoundary, TableOverBar } from './screens'
import type { SoloPlaytest } from './session'
import { forgetPlaytest } from './storage'
import { PlaytestSummaryScreen } from './SummaryScreen'
import { useSoloPlaytest } from './useSoloPlaytest'

interface PlaytestProps<Settings, State, Move> {
  gameId: string
  game: GameModule<Settings, State, Move>
  initialSession: SoloPlaytest<State>
}

function PlaytestScreens<Settings, State, Move>({ gameId, game, initialSession }: PlaytestProps<Settings, State, Move>) {
  const playtest = useSoloPlaytest({ game, gameId, initialSession })

  function dealNextTurn() {
    // Every deal is a new seat, maybe at another table: start reading it from the top.
    window.scrollTo(0, 0)
    playtest.dealNextTurn()
  }

  function showSummary() {
    window.scrollTo(0, 0)
    playtest.showSummary()
  }

  if (playtest.summary) {
    return (
      <PlaytestSummaryScreen
        summary={playtest.summary}
        appearanceOf={game.playerAppearance}
        onKeepPlaying={dealNextTurn}
        onEnd={() => endPlaytest(gameId)}
      />
    )
  }
  if (playtest.stage === 'between_turns') {
    return (
      <NextTurnScreen
        appearance={game.playerAppearance(PLAYED_SEAT_LOOK)}
        strategyNote={playtest.strategyNote}
        onReady={dealNextTurn}
        onShowSummary={showSummary}
      />
    )
  }
  // Remount per deal so no in-progress selection carries over to another seat or table.
  const board = (
    <game.Board
      key={playtest.dealCount}
      state={playtest.state}
      role={playtest.role}
      players={playtest.players}
      onMove={playtest.submitMove}
      seating="hot_seat"
      lookOf={playtest.lookOf}
    />
  )
  if (playtest.stage === 'playing') return board
  return (
    <>
      {board}
      <TableOverBar openTableCount={playtest.openTableCount} onNextTurn={dealNextTurn} onShowSummary={showSummary} />
    </>
  )
}

function endPlaytest(gameId: string) {
  forgetPlaytest(gameId)
  returnToLobby()
}

/** A hot-seat playtest from its first deal to its summary, resumable after a reload. */
export function SoloPlaytestMatch<Settings, State, Move>(props: PlaytestProps<Settings, State, Move>) {
  return (
    <PlaytestErrorBoundary onDiscard={() => endPlaytest(props.gameId)}>
      <PlaytestScreens {...props} />
    </PlaytestErrorBoundary>
  )
}
