/** How the players of an online match are connected. */
export type Transport = 'live' | 'async'

/** What the lobby offers: an online transport, or everyone sharing one device. */
export type PlayMode = Transport | 'hot_seat'

/**
 * Who is looking at the board. In a hot-seat match everyone reads the same screen, so
 * the board should name players rather than calling one of them "You".
 */
export type Seating = 'remote' | 'hot_seat'

export interface RoomLink {
  code: string
  transport: Transport
}

/** Room codes avoid I and O so they can't be confused with 1 and 0 when read aloud. */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const ROOM_CODE_LENGTH = 4

export function generateRoomCode(): string {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
  ).join('')
}

/** A random 32-bit seed for a new match's randomness. */
export function generateSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** Reads `?room=CODE[&mode=async]`; room links without a mode are live. */
export function parseRoomLink(search: string): RoomLink | null {
  const params = new URLSearchParams(search)
  const code = params.get('room')
  if (!code) return null
  return { code: code.toUpperCase(), transport: params.get('mode') === 'async' ? 'async' : 'live' }
}

/** The shareable link to a room, built on the page's own address (origin plus path). */
export function roomUrl({ code, transport }: RoomLink, pageAddress: string): string {
  const url = new URL(pageAddress)
  url.search = ''
  url.searchParams.set('room', code)
  if (transport === 'async') url.searchParams.set('mode', 'async')
  return url.toString()
}

export function readRoomLinkFromUrl(): RoomLink | null {
  return parseRoomLink(window.location.search)
}

export function buildRoomUrl(link: RoomLink): string {
  return roomUrl(link, window.location.origin + window.location.pathname)
}
