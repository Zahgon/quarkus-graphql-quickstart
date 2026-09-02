/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { Book } from '../../orm/panache/entity/book.js';

/**
 * Represents an edge in a connection, containing a node and a cursor.
 */
export class BookEdge {
  /**
   * Constructs a new BookEdge instance.
   *
   * @param node the Book node
   * @param cursor the cursor for this edge
   */
  private constructor(
    /** The node of type Book. */
    readonly node: Book,
    /** The cursor for this edge. */
    readonly cursor: string,
  ) {}

  /**
   * Creates a new BookEdge instance.
   *
   * @param node the Book node
   * @param cursor the cursor for this edge
   * @returns a new BookEdge instance
   */
  static create(node: Book, cursor: string): BookEdge {
    return new BookEdge(node, cursor);
  }
}
