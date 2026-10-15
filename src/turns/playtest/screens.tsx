import { Component, type ReactNode } from 'react'
import { Button, Card, ColorSwatch, FieldLabel } from '../../core/controls'
import { CenteredScreen } from '../../core/screens'
import type { PlayerAppearance } from '../types'

/** "1 table", "3 tables". */
export function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

const TEXT_LINK_CLASSES = 'text-xs font-semibold text-ink-soft underline hover:text-ink'

const QUIT_CONFIRMATION = 'Quit this playtest? Every table in it will be discarded.'

/** Asks before throwing the playtest away, since it can't be got back. */
function confirmQuit(onQuit: () => void) {
  if (window.confirm(QUIT_CONFIRMATION)) onQuit()
}

/** Sits above a hot-seat table so the tester can leave the playtest at any point. */
export function PlaytestBar({ onQuit }: { onQuit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule bg-paper px-4 py-2 text-sm">
      <span className="font-semibold text-ink-soft">Hot-seat playtest</span>
      <Button tone="secondary" className="px-3 py-1.5 text-sm" onClick={() => confirmQuit(onQuit)}>
        Quit
      </Button>
    </div>
  )
}

export function StrategyNote({ note, label }: { note: string; label: string }) {
  return (
    <Card className="w-full text-left">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-1 whitespace-pre-wrap text-sm">{note}</p>
    </Card>
  )
}

/**
 * Hides the board between hot-seat turns, so each turn starts with a fresh look at a table
 * and a stray second click can't land on the next one.
 */
export function NextTurnScreen({
  appearance,
  strategyNote,
  onReady,
  onShowSummary,
  onQuit,
}: {
  appearance: PlayerAppearance
  strategyNote: string
  onReady: () => void
  onShowSummary: () => void
  onQuit: () => void
}) {
  return (
    <CenteredScreen>
      <h2 className="text-2xl font-bold">Next turn</h2>
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        You play <ColorSwatch color={appearance.color} /> <span className="font-semibold text-ink">{appearance.name}</span>
      </p>
      {strategyNote && (
        <div className="w-full max-w-sm">
          <StrategyNote note={strategyNote} label="Your strategy" />
        </div>
      )}
      <Button onClick={onReady} className="px-8 py-3 text-lg">
        Ready
      </Button>
      <button type="button" onClick={onShowSummary} className={TEXT_LINK_CLASSES}>
        Summary so far
      </button>
      <button type="button" onClick={() => confirmQuit(onQuit)} className={TEXT_LINK_CLASSES}>
        Quit playtest
      </button>
    </CenteredScreen>
  )
}

/** Sits under a hot-seat table that just finished, which is shown with its real seats. */
export function TableOverBar({
  openTableCount,
  onNextTurn,
  onShowSummary,
}: {
  openTableCount: number
  onNextTurn: () => void
  onShowSummary: () => void
}) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-rule bg-paper px-4 py-3 text-sm">
      <p>
        <span className="font-semibold">This table is over.</span> Colours now show the real seats.
      </p>
      {openTableCount > 0 ? (
        <>
          <Button tone="secondary" onClick={onShowSummary}>
            Summary so far
          </Button>
          <Button onClick={onNextTurn}>Next turn · {countOf(openTableCount, 'table')} left</Button>
        </>
      ) : (
        <Button onClick={onShowSummary}>See the summary</Button>
      )}
    </div>
  )
}

interface ErrorBoundaryProps {
  onDiscard: () => void
  children: ReactNode
}

/**
 * A saved playtest outlives the code that made it, so after the game changes its states
 * may no longer render. Rather than crash on every reload, offer to throw it away.
 */
export class PlaytestErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown): void {
    console.error('The hot-seat playtest failed to render; offering to discard it.', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <CenteredScreen>
        <h2 className="text-2xl font-bold">This playtest can’t be shown</h2>
        <p className="max-w-md text-sm text-ink-soft">
          {this.state.error.message} A playtest saved before the game changed may not work with the new version.
        </p>
        <Button onClick={this.props.onDiscard}>Discard it and return to the lobby</Button>
      </CenteredScreen>
    )
  }
}
