/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { BroadcastProcessor } from '../../src/deps/broadcast-processor.js';

/**
 * A test the original does not have: Mutiny's `BroadcastProcessor` supplied
 * this behaviour, and the port implements it. What has to hold is that the
 * stream is *hot* — every current subscriber sees an item, and a subscriber
 * that arrives afterwards sees nothing that came before.
 */
describe('BroadcastProcessorTest', () => {
  it('onNext_deliversToEveryCurrentSubscriber', async () => {
    const processor = BroadcastProcessor.create<string>();
    const first = processor[Symbol.asyncIterator]();
    const second = processor[Symbol.asyncIterator]();
    expect(processor.subscriberCount).toBe(2);

    const received = Promise.all([first.next(), second.next()]);
    processor.onNext('a book');

    expect((await received).map((result) => result.value)).toEqual(['a book', 'a book']);
    await first.return?.();
    await second.return?.();
  });

  it('onNext_isNotReplayedToALaterSubscriber', async () => {
    const processor = BroadcastProcessor.create<string>();
    processor.onNext('missed');

    const late = processor[Symbol.asyncIterator]();
    const pending = late.next();
    processor.onNext('seen');

    expect((await pending).value).toBe('seen');
    await late.return?.();
  });

  it('return_detachesTheSubscriber', async () => {
    const processor = BroadcastProcessor.create<string>();
    const subscriber = processor[Symbol.asyncIterator]();
    expect(processor.subscriberCount).toBe(1);

    expect(await subscriber.return?.()).toEqual({ value: undefined, done: true });
    expect(processor.subscriberCount).toBe(0);
  });

  it('throw_detachesTheSubscriberAndPropagates', async () => {
    const processor = BroadcastProcessor.create<string>();
    const subscriber = processor[Symbol.asyncIterator]();

    await expect(subscriber.throw?.(new Error('boom'))).rejects.toThrow('boom');
    expect(processor.subscriberCount).toBe(0);
  });
});
