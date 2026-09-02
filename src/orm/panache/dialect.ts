/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { ColumnType } from './metadata.js';

/**
 * The parts of SQL the two supported databases spell differently.
 *
 * Hibernate calls this a `Dialect` and picks one from
 * `quarkus.datasource.db-kind`; the same key selects one here. Everything the
 * mapping engine emits is written once, in the portable form, and the dialect
 * adapts the three things that are not portable: parameter markers, column
 * types, and the expression that orders rows by the order they were inserted.
 */
export interface Dialect {
  /** The `db-kind` this dialect serves. */
  readonly name: string;

  /**
   * Rewrites the portable `?` markers into whatever the driver expects.
   *
   * Statements are built with `?` throughout and never contain a literal, so
   * the rewrite is a straight positional substitution.
   */
  bind(sql: string): string;

  /** The DDL type for a mapped column. */
  columnType(type: ColumnType, length: number | undefined): string;
}

function varchar(type: ColumnType, length: number | undefined): string {
  switch (type) {
    case 'integer':
      return 'INTEGER';
    case 'date':
      return 'DATE';
    case 'string':
      return length === undefined ? 'VARCHAR(255)' : `VARCHAR(${String(length)})`;
  }
}

/** The in-memory engine that stands in for `quarkus.datasource.db-kind=h2`. */
export const sqliteDialect: Dialect = {
  name: 'h2',
  bind: (sql) => sql,
  columnType: varchar,
};

/** `quarkus.datasource.db-kind=postgresql`. */
export const postgresDialect: Dialect = {
  name: 'postgresql',
  bind: (sql) => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${String((index += 1))}`);
  },
  columnType: varchar,
};

export function dialectFor(dbKind: string): Dialect {
  switch (dbKind) {
    case 'h2':
      return sqliteDialect;
    case 'postgresql':
      return postgresDialect;
    default:
      throw new Error(`Unsupported datasource db-kind '${dbKind}'`);
  }
}
