import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TurnBar, type TurnActions } from './TurnBar'

const ignore = () => {}
const idle: TurnActions = { canUndo: false, canEndTurn: false, onUndo: ignore, onEndTurn: ignore }

const render = (overrides: Partial<TurnActions> = {}) => renderToStaticMarkup(<TurnBar {...idle} {...overrides} />)

describe('turn bar', () => {
  it('offers Undo and End turn', () => {
    expect(render()).toContain('Undo')
    expect(render()).toContain('End turn')
  })

  it('holds both buttons back before the first move', () => {
    expect(render().match(/disabled=""/g)).toHaveLength(2)
  })

  it('lets the player undo once they have moved', () => {
    expect(render({ canUndo: true }).match(/disabled=""/g)).toHaveLength(1)
    expect(render({ canUndo: true })).toContain('stay on your screen')
  })

  it('tells the player to end a turn that has passed', () => {
    expect(render({ canUndo: true, canEndTurn: true })).toContain('End it to pass play on')
    expect(render({ canUndo: true, canEndTurn: true })).not.toContain('disabled=""')
  })
})
