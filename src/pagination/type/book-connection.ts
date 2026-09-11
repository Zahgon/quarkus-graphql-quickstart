/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { BookEdge } from './book-edge.js';
import type { PageInfo } from './page-info.js';

/**
 * Represents a connection to a list of Book edges with pagination information.
 */
export class BookConnection {
  /**
   * Constructs a new BookConnection instance.
   *
   * @param edges a list of Book edges
   * @param pageInfo pagination information for the connection
   */
  private constructor(
    /** A list of Book edges. */
    readonly edges: readonly BookEdge[],
    /** Pagination information for the connection. */
    readonly pageInfo: PageInfo | null,
  ) {}

  /**
   * Creates a new BookConnection instance.
   *
   * @param edges a list of Book edges
   * @param pageInfo pagination information for the connection
   * @returns a new BookConnection instance
   */
  static create(edges: readonly BookEdge[], pageInfo: PageInfo | null): BookConnection {
    return new BookConnection(edges, pageInfo);
  }
}
