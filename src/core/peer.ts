export const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
}

/**
 * Room ids live in the public PeerJS server's global namespace, so they are prefixed
 * with the game id to keep lab games from joining each other's rooms.
 */
export function hostPeerId(gameId: string, roomCode: string): string {
  return `${gameId}-${roomCode}`
}

export function describePeerError(err: Error & { type: string }): string {
  if (err.type === 'unavailable-id') return 'Room code already in use.'
  if (err.type === 'peer-unavailable') return 'Room not found. The host may have closed the game.'
  return err.message || 'Connection error.'
}
