import { Button } from '../core/controls'

/** What a player can do with the turn on their screen. */
export interface TurnActions {
  canUndo: boolean
  /** True once play has passed to someone else and the turn only needs ending. */
  canEndTurn: boolean
  onUndo: () => void
  onEndTurn: () => void
}

export const BAR_BUTTON_CLASSES = 'px-3 py-1.5 text-sm'

/** Undo and End turn, for a bar above the board. */
export function TurnActionButtons({ canUndo, canEndTurn, onUndo, onEndTurn }: TurnActions) {
  return (
    <>
      <Button tone="secondary" className={BAR_BUTTON_CLASSES} disabled={!canUndo} onClick={onUndo}>
        Undo
      </Button>
      <Button className={BAR_BUTTON_CLASSES} disabled={!canEndTurn} onClick={onEndTurn}>
        End turn
      </Button>
    </>
  )
}

function hintOf({ canUndo, canEndTurn }: TurnActions): string {
  if (canEndTurn) return 'Your turn is over. End it to pass play on.'
  if (canUndo) return 'Your moves stay on your screen until you end your turn.'
  return 'Your turn.'
}

/** Sits above the board of an online match while the player has a turn on their screen. */
export function TurnBar(actions: TurnActions) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule bg-paper px-4 py-2 text-sm">
      <p className="font-semibold text-ink-soft">{hintOf(actions)}</p>
      <TurnActionButtons {...actions} />
    </div>
  )
}
