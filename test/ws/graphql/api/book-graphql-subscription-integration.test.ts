/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { createClient } from 'graphql-ws';
import { describe, expect, it } from 'vitest';

import { baseUrl } from '../../../support/application.js';
import { graphql, path } from '../../../support/rest.js';

/**
 * A test the original does not have.
 *
 * SmallRye GraphQL and Mutiny carried the `bookCreated` subscription between
 * them; the port owns both ends — the `graphql-transport-ws` endpoint and the
 * broadcast that feeds it — so the behaviour needs a test of its own.
 */
describe('BookGraphQLSubscriptionIntegrationTest', () => {
  it('bookCreated_notifiesSubscribersOfANewBook', async () => {
    const url = (await baseUrl()).replace(/^http/, 'ws') + '/api/graphql';
    const client = createClient({ url, webSocketImpl: WebSocket, retryAttempts: 0 });

    const events = client.iterate<{ bookCreated: { id: number; title: string } }>({
      query: 'subscription { bookCreated { id title } }',
    });
    // Pull once so the subscription is registered before the mutation runs.
    const received = events.next();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const created = await graphql(
      'mutation { createBook(book: {title: "Subscribed Book", isbn: "9999999999999", ' +
        'pages: 100, summary: "Broadcast me", publication: "2025-02-01", genre: "demo"}) ' +
        '{ id title } }',
    );
    expect(path(created, 'data.createBook.title')).toBe('Subscribed Book');

    const event = await received;
    expect(event.value?.data?.bookCreated.title).toBe('Subscribed Book');
    expect(event.value?.data?.bookCreated.id).toBe(path(created, 'data.createBook.id'));

    await events.return?.(undefined);
    await client.dispose();
  });

  it('query_isAnsweredOverTheWebSocketTransportToo', async () => {
    const url = (await baseUrl()).replace(/^http/, 'ws') + '/api/graphql';
    const client = createClient({ url, webSocketImpl: WebSocket, retryAttempts: 0 });

    const result = await new Promise<{ editor: { id: number; name: string } }>(
      (resolve, reject) => {
        let value: { editor: { id: number; name: string } } | undefined;
        client.subscribe<{ editor: { id: number; name: string } }>(
          { query: '{ editor(editorId: 3) { id name } }' },
          {
            next: (payload) => {
              value = payload.data ?? undefined;
            },
            error: reject,
            complete: () => {
              if (value === undefined) {
                reject(new Error('no payload'));
              } else {
                resolve(value);
              }
            },
          },
        );
      },
    );

    expect(result.editor.id).toBe(3);
    expect(result.editor.name).toBe('Global Tech Publications');
    await client.dispose();
  });

  it('upgrade_isRefusedOnAnyOtherPath', async () => {
    const url = (await baseUrl()).replace(/^http/, 'ws') + '/api/books';
    const socket = new WebSocket(url);

    await expect(
      new Promise((resolve, reject) => {
        socket.addEventListener('error', () => {
          reject(new Error('upgrade refused'));
        });
        socket.addEventListener('close', () => {
          reject(new Error('upgrade refused'));
        });
        socket.addEventListener('open', resolve);
      }),
    ).rejects.toThrow('upgrade refused');
  });
});
