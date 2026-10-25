// What a browser remembers between visits: its seat in each room, the name it plays
// under, and any solo playtest in progress. Storage can be unavailable (private windows, blocked site data), so reads fall
// back to "nothing remembered" and writes are best effort; both log why.

export const MAX_PLAYER_NAME_LENGTH = 24

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (err) {
    console.warn(`Could not read ${key} from localStorage; treating it as unset.`, err)
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (err) {
    console.warn(`Could not save ${key} to localStorage; it won't be remembered after a reload.`, err)
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (err) {
    console.warn(`Could not remove ${key} from localStorage; it may come back after a reload.`, err)
  }
}

export function normalizePlayerName(name: string): string {
  return name.trim().slice(0, MAX_PLAYER_NAME_LENGTH)
}

const playerNameKey = (gameId: string) => `${gameId}-player-name`

/** The name this browser last played under, to prefill the next lobby or join screen. */
export function recallPlayerName(gameId: string): string {
  return readStored(playerNameKey(gameId)) ?? ''
}

export function rememberPlayerName(gameId: string, name: string): void {
  writeStored(playerNameKey(gameId), name)
}
