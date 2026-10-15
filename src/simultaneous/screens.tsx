import { Button } from '../core/controls'
import type { RoomLink } from '../core/roomLink'
import { CenteredScreen, ShareLink } from '../core/screens'
import type { PlayerSlot } from './types'

export function WaitingForPartnerScreen({ room }: { room: RoomLink }) {
  return (
    <CenteredScreen>
      <h2 className="text-2xl font-semibold">Waiting for an opponent…</h2>
      <p className="text-sm text-ink-soft">Share this link:</p>
      <ShareLink room={room} />
      {room.transport === 'live' && <p className="text-xs text-ink-faint">Anyone else who opens the link watches as a spectator.</p>}
    </CenteredScreen>
  )
}

/** Hides the board between hot-seat inputs so the next player can't see the last one's. */
export function HandoffScreen({ slot, onReady }: { slot: PlayerSlot; onReady: () => void }) {
  return (
    <CenteredScreen>
      <h2 className="text-2xl font-semibold">Pass the device to Player {slot}</h2>
      <p className="text-sm text-ink-soft">Player {slot}, press Ready when the other player isn't looking.</p>
      <Button onClick={onReady} className="px-8 py-3 text-lg">
        Ready
      </Button>
    </CenteredScreen>
  )
}
