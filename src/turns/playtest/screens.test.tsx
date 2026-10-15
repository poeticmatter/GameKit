import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlaytestBar, TableOverBar, type TurnControls } from './screens'
import type { PlaytestSummary } from './summary'
import { PlaytestSummaryScreen } from './SummaryScreen'

const appearanceOf = (seat: number) => ({ name: ['Red', 'Blue', 'Green'][seat], color: '#000' })
const ignore = () => {}

const summary: PlaytestSummary = {
  strategyNote: 'Never trade with Blue',
  turnCount: 9,
  tables: [
    {
      turnCount: 6,
      isOver: true,
      seats: [
        { seat: 1, turnPosition: 0, score: 4, hasWon: true },
        { seat: 0, turnPosition: 1, score: 2, hasWon: false },
      ],
    },
    { turnCount: 3, isOver: false, seats: [{ seat: 0, turnPosition: 0, score: null, hasWon: false }] },
  ],
  winsByTurnPosition: [1, 0],
}

function renderSummary(overrides: Partial<PlaytestSummary> = {}): string {
  return renderToStaticMarkup(
    <PlaytestSummaryScreen summary={{ ...summary, ...overrides }} appearanceOf={appearanceOf} onKeepPlaying={ignore} onEnd={ignore} />,
  )
}

const turn: TurnControls = { appearance: appearanceOf(0), canUndo: false, canEndTurn: false, onUndo: ignore, onEndTurn: ignore }

function renderBar(overrides: Partial<ComponentProps<typeof PlaytestBar>> = {}): string {
  return renderToStaticMarkup(<PlaytestBar turn={turn} strategyNote="" onShowSummary={null} onQuit={ignore} {...overrides} />)
}

describe('playtest bar', () => {
  it('names the colour the tester plays', () => {
    expect(renderBar()).toContain('Red')
  })

  it('reminds the tester of their strategy', () => {
    expect(renderBar({ strategyNote: 'Hoard wood' })).toContain('Hoard wood')
  })

  it('offers to end the turn once it has passed', () => {
    expect(renderBar({ turn: { ...turn, canEndTurn: true } })).toMatch(/<button(?![^>]*disabled="")[^>]*>End turn</)
  })

  it('holds back ending the turn while the seat can still move', () => {
    expect(renderBar()).toMatch(/<button[^>]*disabled=""[^>]*>End turn</)
  })

  it('holds back undo before any move', () => {
    expect(renderBar()).toMatch(/<button[^>]*disabled=""[^>]*>Undo</)
  })

  it('offers the summary when it can be opened', () => {
    expect(renderBar({ onShowSummary: ignore })).toContain('Summary so far')
  })

  it('leaves out the turn controls once the table is over', () => {
    expect(renderBar({ turn: null })).not.toContain('End turn')
  })

  it('lets the tester quit the playtest', () => {
    expect(renderBar()).toContain('Quit')
  })
})

describe('table over bar', () => {
  it('counts the tables still in play', () => {
    expect(renderToStaticMarkup(<TableOverBar openTableCount={2} onNextTurn={ignore} onShowSummary={ignore} />)).toContain('2 tables left')
  })

  it('leads to the summary after the last table', () => {
    expect(renderToStaticMarkup(<TableOverBar openTableCount={0} onNextTurn={ignore} onShowSummary={ignore} />)).toContain('See the summary')
  })
})

describe('playtest summary screen', () => {
  it('shows the strategy the tester played by', () => {
    expect(renderSummary()).toContain('Never trade with Blue')
  })

  it('marks a table’s winner', () => {
    expect(renderSummary()).toContain('Won')
  })

  it('offers to keep playing while a table is unfinished', () => {
    expect(renderSummary()).toContain('Keep playing')
  })

  it('only offers to end once every table is over', () => {
    expect(renderSummary({ tables: [summary.tables[0]] })).not.toContain('Keep playing')
  })
})
