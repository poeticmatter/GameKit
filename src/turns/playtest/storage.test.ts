import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePlaytest, serializePlaytest } from './storage'
import { playThrough, startTally } from './tallyGame'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('saved playtests', () => {
  it('come back exactly as they were saved', () => {
    const session = playThrough(startTally([0, 1], 'Rush the middle'), ['add', 'pass'])
    expect(parsePlaytest(serializePlaytest(session))).toEqual(session)
  })

  it('keep moves not yet ended', () => {
    const session = playThrough(startTally([0, 1]), ['add', 'pass', 'add'])
    expect(parsePlaytest(serializePlaytest(session))).toEqual(session)
  })

  it('are absent when nothing was saved', () => {
    expect(parsePlaytest(null)).toBeNull()
  })

  it('are ignored when the save is not JSON', () => {
    expect(parsePlaytest('{not json')).toBeNull()
  })

  it('are ignored when saved in another format version', () => {
    const saved = JSON.parse(serializePlaytest(startTally([0])))
    expect(parsePlaytest(JSON.stringify({ ...saved, version: 99 }))).toBeNull()
  })

  it('are ignored when the table on screen doesn’t exist', () => {
    const session = startTally([0])
    expect(parsePlaytest(serializePlaytest({ ...session, tableIndex: 3 }))).toBeNull()
  })
})
