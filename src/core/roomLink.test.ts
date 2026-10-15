import { describe, expect, it } from 'vitest'
import { generateRoomCode, parseRoomLink, roomUrl } from './roomLink'

describe('room links', () => {
  it('reads an async room from the query string', () => {
    expect(parseRoomLink('?room=abcd&mode=async')).toEqual({ code: 'ABCD', transport: 'async' })
  })

  it('treats a room without a mode as live', () => {
    expect(parseRoomLink('?room=WXYZ')).toEqual({ code: 'WXYZ', transport: 'live' })
  })

  it('finds no room on a plain lobby URL', () => {
    expect(parseRoomLink('')).toBeNull()
  })

  it('builds a link on the page address, dropping any old query', () => {
    expect(roomUrl({ code: 'ABCD', transport: 'async' }, 'https://example.org/Votes/?room=OLD')).toBe(
      'https://example.org/Votes/?room=ABCD&mode=async',
    )
  })

  it('round-trips a link through its URL', () => {
    const link = { code: 'QRST', transport: 'live' as const }
    expect(parseRoomLink(new URL(roomUrl(link, 'https://example.org/Game/')).search)).toEqual(link)
  })

  it('makes four-letter codes without I or O', () => {
    const codes = Array.from({ length: 200 }, generateRoomCode)
    expect(codes.every(code => /^[A-HJ-NP-Z]{4}$/.test(code))).toBe(true)
  })
})
