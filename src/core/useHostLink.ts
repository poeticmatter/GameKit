import { useCallback, useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import { describePeerError, ICE_CONFIG } from './peer'

/**
 * A guest's link to the host in live play. Connects to the host's peer id and, if the
 * link drops mid-game, reconnects with a growing delay before giving up. What travels
 * over the link is up to the caller.
 */

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY_MS = 1500

export type LinkStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface HostLinkHandlers<HostMessage, GuestMessage> {
  onMessage: (message: HostMessage) => void
  /** Called each time the link opens, including after a reconnect. */
  onConnected?: (send: (message: GuestMessage) => void) => void
}

export interface HostLink<GuestMessage> {
  status: LinkStatus
  /** Set when the link can't be made at all (for example, a bad room code). */
  errorMessage: string | null
  /** Returns false, sending nothing, while the link is down. */
  send: (message: GuestMessage) => boolean
}

export function useHostLink<HostMessage, GuestMessage>(
  hostId: string,
  handlers: HostLinkHandlers<HostMessage, GuestMessage>,
): HostLink<GuestMessage> {
  const [status, setStatus] = useState<LinkStatus>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const connection = useRef<DataConnection | null>(null)

  // Peer callbacks outlive renders; they always call the newest handlers.
  const latestHandlers = useRef(handlers)
  useEffect(() => {
    latestHandlers.current = handlers
  })

  useEffect(() => {
    let peer: Peer | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempts = 0
    let isDisposed = false

    function scheduleReconnect() {
      if (isDisposed || reconnectTimer !== null) return
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        setStatus('disconnected')
        return
      }
      reconnectAttempts++
      setStatus('reconnecting')
      peer?.destroy()
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, reconnectAttempts * RECONNECT_BASE_DELAY_MS)
    }

    function connect() {
      const isReconnecting = reconnectAttempts > 0
      const thisPeer = new Peer({ config: ICE_CONFIG })
      peer = thisPeer

      thisPeer.on('open', () => {
        const opened = thisPeer.connect(hostId, { reliable: true })
        connection.current = opened
        opened.on('open', () => {
          reconnectAttempts = 0
          setStatus('connected')
          latestHandlers.current.onConnected?.(message => opened.send(message))
        })
        // Only the host sends on this link; PeerJS delivers untyped payloads.
        opened.on('data', raw => latestHandlers.current.onMessage(raw as HostMessage))
        opened.on('close', scheduleReconnect)
        opened.on('error', scheduleReconnect)
      })

      thisPeer.on('error', err => {
        // A missing host on first contact is a bad link; mid-game it may just be a blip.
        if (err.type === 'peer-unavailable' && isReconnecting) {
          scheduleReconnect()
          return
        }
        setErrorMessage(describePeerError(err))
      })
    }

    connect()

    return () => {
      isDisposed = true
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      peer?.destroy()
      connection.current = null
    }
  }, [hostId])

  const send = useCallback((message: GuestMessage) => {
    if (!connection.current?.open) return false
    connection.current.send(message)
    return true
  }, [])

  return { status, errorMessage, send }
}
