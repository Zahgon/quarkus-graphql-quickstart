/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { EntityMetadata } from './metadata.js';
import { currentEntityManager } from './session.js';

interface Filter {
  readonly query: string;
  readonly params: readonly unknown[];
}

interface Bounds {
  readonly from: number;
  readonly to: number;
}

/**
 * `io.quarkus.hibernate.orm.panache.PanacheQuery`, limited to the operations
 * the application performs: `range`, `list`, `firstResult` and `count`.
 */
export class PanacheQuery<T> {
  constructor(
    private readonly metadata: EntityMetadata,
    private readonly filter: Filter | null = null,
    private readonly bounds: Bounds | null = null,
  ) {}

  /** An inclusive index range, exactly as Panache defines it. */
  range(startIndex: number, lastIndex: number): PanacheQuery<T> {
    return new PanacheQuery<T>(this.metadata, this.filter, {
      from: startIndex,
      to: lastIndex,
    });
  }

  async list(): Promise<T[]> {
    const entityManager = await currentEntityManager();
    if (this.filter !== null) {
      const matches = await entityManager.query(
        this.metadata,
        this.filter.query,
        this.filter.params,
      );
      const sliced =
        this.bounds === null ? matches : matches.slice(this.bounds.from, this.bounds.to + 1);
      return sliced as unknown as T[];
    }
    const rows =
      this.bounds === null
        ? await entityManager.listAll(this.metadata)
        : await entityManager.range(this.metadata, this.bounds.from, this.bounds.to);
    return rows as unknown as T[];
  }

  async firstResult(): Promise<T | null> {
    return (await this.list())[0] ?? null;
  }

  async count(): Promise<number> {
    const entityManager = await currentEntityManager();
    if (this.filter !== null) {
      return (await entityManager.query(this.metadata, this.filter.query, this.filter.params))
        .length;
    }
    return await entityManager.count(this.metadata);
  }
}
