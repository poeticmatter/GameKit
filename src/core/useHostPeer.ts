import { useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import { describePeerError, ICE_CONFIG } from './peer'

/**
 * The host's side of live play: registers the room's peer id on the PeerJS server and
 * reports guests arriving, talking and leaving. What those messages mean is up to the
 * caller, which also owns all match state.
 */

export interface HostPeerHandlers<GuestMessage> {
  onGuestOpen: (connection: DataConnection) => void
  onGuestMessage: (connection: DataConnection, message: GuestMessage) => void
  /** A guest closed the connection or it failed. */
  onGuestGone: (connection: DataConnection) => void
}

export interface HostPeer {
  /** True once the room's id is registered and guests can connect. */
  isOpen: boolean
  errorMessage: string | null
}

export function useHostPeer<GuestMessage>(peerId: string, handlers: HostPeerHandlers<GuestMessage>): HostPeer {
  const [isOpen, setIsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Peer callbacks outlive renders; they always call the newest handlers.
  const latestHandlers = useRef(handlers)
  useEffect(() => {
    latestHandlers.current = handlers
  })

  useEffect(() => {
    const peer = new Peer(peerId, { config: ICE_CONFIG })
    peer.on('open', () => setIsOpen(true))
    peer.on('connection', connection => {
      connection.on('open', () => latestHandlers.current.onGuestOpen(connection))
      // PeerJS delivers untyped payloads; every guest of this room speaks GuestMessage.
      connection.on('data', raw => latestHandlers.current.onGuestMessage(connection, raw as GuestMessage))
      connection.on('close', () => latestHandlers.current.onGuestGone(connection))
      connection.on('error', () => latestHandlers.current.onGuestGone(connection))
    })
    peer.on('error', err => setErrorMessage(describePeerError(err)))
    return () => peer.destroy()
  }, [peerId])

  return { isOpen, errorMessage }
}

/** Sends to a guest if the connection is still open; a closed one is about to be dropped. */
export function sendToGuest<HostMessage>(connection: DataConnection, message: HostMessage): void {
  if (connection.open) connection.send(message)
}
