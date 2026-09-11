/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * `io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor` — the hot,
 * multicast stream behind the `bookCreated` subscription.
 *
 * The behaviour that has to carry over is that it is *hot*: an item is
 * delivered to whoever is subscribed at the moment it is emitted, and a
 * subscriber that arrives later sees nothing that came before. A `Multi` is an
 * async stream of items, which in TypeScript is an `AsyncIterable`.
 */
export class BroadcastProcessor<T> implements AsyncIterable<T> {
  private readonly subscribers = new Set<(item: T) => void>();

  static create<T>(): BroadcastProcessor<T> {
    return new BroadcastProcessor<T>();
  }

  /** Emits an item to every current subscriber. */
  onNext(item: T): void {
    for (const subscriber of this.subscribers) {
      subscriber(item);
    }
  }

  /** How many streams are currently attached; used to reason about delivery. */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    const pending: T[] = [];
    let notify: (() => void) | null = null;

    const push = (item: T): void => {
      pending.push(item);
      notify?.();
    };
    this.subscribers.add(push);

    const detach = (): void => {
      this.subscribers.delete(push);
    };

    return {
      next: async (): Promise<IteratorResult<T>> => {
        const buffered = pending.shift();
        if (buffered !== undefined) {
          return { value: buffered, done: false };
        }
        await new Promise<void>((resolve) => {
          notify = (): void => {
            notify = null;
            resolve();
          };
        });
        return { value: pending.shift() as T, done: false };
      },
      return: async (): Promise<IteratorResult<T>> => {
        detach();
        return { value: undefined, done: true };
      },
      throw: async (error?: unknown): Promise<IteratorResult<T>> => {
        detach();
        throw error;
      },
    };
  }
}
