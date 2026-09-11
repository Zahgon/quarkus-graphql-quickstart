/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * Represents pagination information for a connection.
 */
export class PageInfo {
  /**
   * Constructs a new PageInfo instance.
   *
   * @param hasNextPage indicates if there is a next page
   * @param endCursor the end cursor for the current page
   */
  private constructor(
    /** Indicates if there is a next page. */
    readonly hasNextPage: boolean,
    /** The end cursor for the current page. */
    readonly endCursor: string | null,
  ) {}

  /**
   * Creates a new PageInfo instance.
   *
   * @param hasNextPage indicates if there is a next page
   * @param endCursor the end cursor for the current page
   * @returns a new PageInfo instance
   */
  static create(hasNextPage: boolean, endCursor: string | null): PageInfo {
    return new PageInfo(hasNextPage, endCursor);
  }
}
