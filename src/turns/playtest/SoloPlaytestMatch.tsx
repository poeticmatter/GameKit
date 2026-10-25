import { returnToLobby } from '../../core/screens'
import { PLAYED_SEAT_LOOK } from '../../core/seatDisguise'
import type { GameModule } from '../types'
import { PlaytestBar, PlaytestErrorBoundary, TableOverBar, type TurnControls } from './screens'
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

  // Every deal is a new seat, maybe at another table: start reading it from the top.
  function dealNextTurn() {
    window.scrollTo(0, 0)
    playtest.dealNextTurn()
  }

  function endTurn() {
    window.scrollTo(0, 0)
    playtest.endTurn()
  }

  function showSummary() {
    window.scrollTo(0, 0)
    playtest.showSummary()
  }

  const quit = () => endPlaytest(gameId)

  if (playtest.summary) {
    return (
      <PlaytestSummaryScreen
        summary={playtest.summary}
        appearanceOf={game.playerAppearance}
        onKeepPlaying={dealNextTurn}
        onEnd={quit}
      />
    )
  }

  const isTableOver = playtest.stage === 'table_over'
  const turn: TurnControls | null = isTableOver
    ? null
    : {
        appearance: game.playerAppearance(PLAYED_SEAT_LOOK),
        canUndo: playtest.canUndo,
        canEndTurn: playtest.stage === 'turn_over',
        onUndo: playtest.undoMove,
        onEndTurn: endTurn,
      }
  return (
    <>
      <PlaytestBar
        turn={turn}
        strategyNote={playtest.strategyNote}
        onShowSummary={playtest.canShowSummary && !isTableOver ? showSummary : null}
        onQuit={quit}
      />
      {/* Remount per deal so no in-progress selection carries over to another seat or table. */}
      <game.Board
        key={playtest.dealCount}
        state={playtest.state}
        role={playtest.role}
        players={playtest.players}
        onMove={playtest.submitMove}
        seating="solo_playtest"
        lookOf={playtest.lookOf}
      />
      {isTableOver && (
        <TableOverBar openTableCount={playtest.openTableCount} onNextTurn={dealNextTurn} onShowSummary={showSummary} />
      )}
    </>
  )
}

function endPlaytest(gameId: string) {
  forgetPlaytest(gameId)
  returnToLobby()
}

/** A solo playtest from its first deal to its summary, resumable after a reload. */
export function SoloPlaytestMatch<Settings, State, Move>(props: PlaytestProps<Settings, State, Move>) {
  return (
    <PlaytestErrorBoundary onDiscard={() => endPlaytest(props.gameId)}>
      <PlaytestScreens {...props} />
    </PlaytestErrorBoundary>
  )
}
