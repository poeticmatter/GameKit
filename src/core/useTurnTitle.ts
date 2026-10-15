import { useEffect } from 'react'

/** Flags the browser tab when it's this player's move, so a game can sit in the background. */
export function useTurnTitle(gameTitle: string, isMyTurn: boolean): void {
  useEffect(() => {
    document.title = isMyTurn ? `● Your turn · ${gameTitle}` : gameTitle
  }, [gameTitle, isMyTurn])

  useEffect(() => () => void (document.title = gameTitle), [gameTitle])
}
