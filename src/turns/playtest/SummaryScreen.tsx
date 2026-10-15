import { Button, Card, ColorSwatch, FieldLabel } from '../../core/controls'
import type { PlayerAppearance, PlayerIndex } from '../types'
import { countOf, StrategyNote } from './screens'
import type { PlaytestSummary, SeatResult, TableSummary } from './summary'

type AppearanceOf = (seat: PlayerIndex) => PlayerAppearance

const ORDINAL_SUFFIXES: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }

/** "1st", "2nd", "3rd", "4th"… for a 0-based turn position. */
function ordinalOf(turnPosition: number): string {
  const place = turnPosition + 1
  const isTeen = place % 100 >= 11 && place % 100 <= 13
  const suffix = isTeen ? 'th' : (ORDINAL_SUFFIXES[place % 10] ?? 'th')
  return `${place}${suffix}`
}

function SeatRow({ result, appearanceOf }: { result: SeatResult; appearanceOf: AppearanceOf }) {
  const appearance = appearanceOf(result.seat)
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-8 text-xs text-ink-faint">{result.turnPosition === null ? '—' : ordinalOf(result.turnPosition)}</span>
      <ColorSwatch color={appearance.color} />
      <span className={`flex-1 ${result.hasWon ? 'font-semibold' : ''}`}>{appearance.name}</span>
      {result.score !== null && <span className="tabular-nums">{result.score}</span>}
      {result.hasWon && <span className="text-xs font-bold uppercase tracking-wider text-accent">Won</span>}
    </li>
  )
}

function TableCard({ table, number, appearanceOf }: { table: TableSummary; number: number; appearanceOf: AppearanceOf }) {
  return (
    <Card className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Table {number}</span>
        <span className="text-xs text-ink-soft">
          {countOf(table.turnCount, 'turn')}
          {table.isOver ? '' : ' · still in play'}
        </span>
      </div>
      <ol className="mt-1 divide-y divide-slot">
        {table.seats.map(result => (
          <SeatRow key={result.seat} result={result} appearanceOf={appearanceOf} />
        ))}
      </ol>
    </Card>
  )
}

function WinsByTurnPosition({ wins, finishedTableCount }: { wins: number[]; finishedTableCount: number }) {
  return (
    <Card className="w-full">
      <FieldLabel>Wins by turn position</FieldLabel>
      <p className="mt-1 text-xs text-ink-soft">Across {countOf(finishedTableCount, 'finished table')}. A tie counts for every winner.</p>
      <ol className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {wins.map((count, turnPosition) => (
          <li key={turnPosition}>
            <span className="text-ink-soft">{ordinalOf(turnPosition)}</span> <span className="font-semibold tabular-nums">{count}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** Every table with its real seats, plus the note the tester played by. */
export function PlaytestSummaryScreen({
  summary,
  appearanceOf,
  onKeepPlaying,
  onEnd,
}: {
  summary: PlaytestSummary
  appearanceOf: AppearanceOf
  onKeepPlaying: () => void
  onEnd: () => void
}) {
  const finishedTableCount = summary.tables.filter(table => table.isOver).length
  const canKeepPlaying = finishedTableCount < summary.tables.length
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center gap-4 p-6">
      <h2 className="text-2xl font-bold">Playtest summary</h2>
      <p className="text-sm text-ink-soft">
        {countOf(summary.tables.length, 'table')} · {countOf(summary.turnCount, 'turn')} played
      </p>
      {summary.strategyNote && <StrategyNote note={summary.strategyNote} label="Strategy" />}
      {summary.winsByTurnPosition && <WinsByTurnPosition wins={summary.winsByTurnPosition} finishedTableCount={finishedTableCount} />}
      {summary.tables.map((table, index) => (
        <TableCard key={index} table={table} number={index + 1} appearanceOf={appearanceOf} />
      ))}
      <div className="flex gap-3 pt-2">
        {canKeepPlaying && <Button onClick={onKeepPlaying}>Keep playing</Button>}
        <Button tone={canKeepPlaying ? 'secondary' : 'primary'} onClick={onEnd}>
          End playtest
        </Button>
      </div>
    </div>
  )
}
