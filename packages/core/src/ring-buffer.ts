/** Fixed-capacity FIFO buffer; the oldest item is dropped when full (FR-08). */
export class RingBuffer<T> {
  private items: T[] = []

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('RingBuffer capacity must be a positive integer')
    }
  }

  push(item: T): void {
    this.items.push(item)
    if (this.items.length > this.capacity) this.items.shift()
  }

  toArray(): T[] {
    return this.items.slice()
  }

  clear(): void {
    this.items = []
  }

  /** Removes the items that match, keeping the rest in order. */
  remove(match: (item: T) => boolean): void {
    this.items = this.items.filter((item) => !match(item))
  }

  get size(): number {
    return this.items.length
  }
}
