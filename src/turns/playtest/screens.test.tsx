import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NextTurnScreen, PlaytestBar, TableOverBar } from './screens'
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

describe('next turn screen', () => {
  it('names the colour the tester plays', () => {
    expect(renderToStaticMarkup(<NextTurnScreen appearance={appearanceOf(0)} strategyNote="" onReady={ignore} onShowSummary={ignore} onQuit={ignore} />)).toContain(
      'Red',
    )
  })

  it('reminds the tester of their strategy', () => {
    const html = renderToStaticMarkup(<NextTurnScreen appearance={appearanceOf(0)} strategyNote="Hoard wood" onReady={ignore} onShowSummary={ignore} onQuit={ignore} />)
    expect(html).toContain('Hoard wood')
  })

  it('lets the tester quit the playtest', () => {
    const html = renderToStaticMarkup(<NextTurnScreen appearance={appearanceOf(0)} strategyNote="" onReady={ignore} onShowSummary={ignore} onQuit={ignore} />)
    expect(html).toContain('Quit playtest')
  })
})

describe('playtest bar', () => {
  it('offers to quit the playtest during a turn', () => {
    expect(renderToStaticMarkup(<PlaytestBar onQuit={ignore} />)).toContain('Quit')
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
