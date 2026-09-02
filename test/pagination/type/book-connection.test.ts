/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Book } from '../../../src/orm/panache/entity/book.js';
import { BookConnection } from '../../../src/pagination/type/book-connection.js';
import { BookEdge } from '../../../src/pagination/type/book-edge.js';
import { PageInfo } from '../../../src/pagination/type/page-info.js';

describe('BookConnectionTest', () => {
  it('createBookConnectionWithValidParameters', () => {
    const edges = [BookEdge.create(new Book(), 'MA==')];
    const pageInfo = PageInfo.create(true, 'MA==');

    const bookConnection = BookConnection.create(edges, pageInfo);

    expect(bookConnection).not.toBeNull();
    expect(bookConnection.edges).toBe(edges);
    expect(bookConnection.pageInfo).toBe(pageInfo);
  });

  it('createBookConnectionWithEmptyEdges', () => {
    const edges: BookEdge[] = [];
    const pageInfo = PageInfo.create(false, 'MA==');

    const bookConnection = BookConnection.create(edges, pageInfo);

    expect(bookConnection).not.toBeNull();
    expect(bookConnection.edges).toBe(edges);
    expect(bookConnection.pageInfo).toBe(pageInfo);
  });

  it('createBookConnectionWithNullPageInfo', () => {
    const edges = [BookEdge.create(new Book(), 'MA==')];

    const bookConnection = BookConnection.create(edges, null);

    expect(bookConnection).not.toBeNull();
    expect(bookConnection.edges).toBe(edges);
    expect(bookConnection.pageInfo).toBeNull();
  });

  it('getNodeReturnsCorrectNode', () => {
    const book = new Book();
    const edge = BookEdge.create(book, 'MA==');

    expect(edge.node).toBe(book);
  });

  it('getCursorReturnsCorrectCursor', () => {
    const edge = BookEdge.create(new Book(), 'MA==');

    expect(edge.cursor).toBe('MA==');
  });

  it('getEndCursorReturnsCorrectEndCursor', () => {
    const pageInfo = PageInfo.create(true, 'MA==');

    expect(pageInfo.endCursor).toBe('MA==');
  });

  it('isHasNextPageReturnsCorrectValue', () => {
    const pageInfo = PageInfo.create(true, 'MA==');

    expect(pageInfo.hasNextPage).toBe(true);
  });
});
