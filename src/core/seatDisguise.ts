import { shuffled } from './random'

/**
 * Seat disguises, for solo playtests. A board draws every seat with some seat's look
 * (its colours, pieces and name); `looks[seat]` says whose. Undisguised, each seat looks
 * like itself. Disguised, the seat being played looks like the first seat and the others
 * take the remaining looks in random order, so the tester sits down as the same colour
 * every turn and can't tell which seat they really hold.
 */

/** The look a disguised tester always plays: the first seat's. */
export const PLAYED_SEAT_LOOK = 0

/** The look for online play, where every seat looks like itself. */
export const undisguised = (seat: number): number => seat

export function undisguisedLooks(seatCount: number): number[] {
  return Array.from({ length: seatCount }, (_, seat) => seat)
}

export function disguiseSeats(seatCount: number, playedSeat: number, randomState: number): { looks: number[]; nextState: number } {
  if (!Number.isInteger(playedSeat) || playedSeat < 0 || playedSeat >= seatCount) {
    throw new RangeError(`Can't disguise seat ${playedSeat} at a table of ${seatCount}.`)
  }
  const seats = undisguisedLooks(seatCount)
  const otherSeats = seats.filter(seat => seat !== playedSeat)
  const { items: otherLooks, nextState } = shuffled(seats.filter(look => look !== PLAYED_SEAT_LOOK), randomState)
  const looks = new Array<number>(seatCount)
  looks[playedSeat] = PLAYED_SEAT_LOOK
  otherSeats.forEach((seat, index) => {
    looks[seat] = otherLooks[index]
  })
  return { looks, nextState }
}
