/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

import type { Dialect } from './dialect.js';
import { postgresDialect, sqliteDialect } from './dialect.js';

/** A value the drivers can bind, after booleans and dates have been narrowed. */
export type SqlValue = string | number | bigint | null | Uint8Array;

export type Row = Record<string, SqlValue>;

/**
 * One connection's worth of the datasource.
 *
 * A transaction belongs to a connection, so the persistence session holds one
 * for its lifetime and gives it back when it ends — which is what Agroal does
 * for the original, one checkout per request.
 */
export interface Connection {
  exec(sql: string): Promise<void>;
  all(sql: string, params: readonly SqlValue[]): Promise<Row[]>;
  run(sql: string, params: readonly SqlValue[]): Promise<void>;
  release(): void;
}

export interface Driver {
  readonly dialect: Dialect;

  /**
   * True when the datasource is a single connection, so overlapping
   * transactions have to be queued rather than run side by side.
   */
  readonly serialised: boolean;

  connection(): Promise<Connection>;
  close(): Promise<void>;
}

/**
 * The in-memory engine, over the SQLite that ships in Node's standard library.
 *
 * It stands in for `jdbc:h2:mem:testdb`: an in-process SQL engine with no
 * server and no native dependency, which is what the default profile asks for.
 * It is a single connection, so its transactions are serialised.
 */
export function createInMemoryDriver(): Driver {
  const database = new DatabaseSync(':memory:');
  // H2 enforces referential integrity by default; SQLite does not unless asked.
  database.exec('PRAGMA foreign_keys = ON');

  const connection: Connection = {
    exec: async (sql) => {
      database.exec(sql);
    },
    all: async (sql, params) => database.prepare(sql).all(...params) as Row[],
    run: async (sql, params) => {
      database.prepare(sql).run(...params);
    },
    release: () => undefined,
  };

  return {
    dialect: sqliteDialect,
    serialised: true,
    connection: async () => connection,
    close: async () => {
      database.close();
    },
  };
}

/** The connection settings a JDBC URL and the datasource credentials add up to. */
export interface PostgresConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly maxSize: number;
}

/**
 * Parses `jdbc:postgresql://host:port/database?opts`.
 *
 * `%prod.quarkus.datasource.jdbc.url` is a JDBC URL, which `pg` does not
 * understand; the host, port and database name are the only parts of it the
 * driver needs.
 */
export function parseJdbcPostgresUrl(jdbcUrl: string): {
  host: string;
  port: number;
  database: string;
} {
  const withoutPrefix = jdbcUrl.replace(/^jdbc:/, '');
  if (!withoutPrefix.startsWith('postgresql://') && !withoutPrefix.startsWith('postgres://')) {
    throw new Error(`Not a PostgreSQL JDBC URL: '${jdbcUrl}'`);
  }
  const url = new URL(withoutPrefix);
  return {
    host: url.hostname === '' ? 'localhost' : url.hostname,
    port: url.port === '' ? 5432 : Number(url.port),
    database: url.pathname.replace(/^\//, ''),
  };
}

/** `%prod.quarkus.datasource.db-kind=postgresql`, over a pool of `jdbc.max-size`. */
export function createPostgresDriver(config: PostgresConfig): Driver {
  // `DATE` arrives as a JavaScript Date otherwise, which shifts the day across
  // time zones; `LocalDate` is the ISO text and nothing else.
  pg.types.setTypeParser(1082, (value: string) => value);

  const pool = new pg.Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.maxSize,
  });

  return {
    dialect: postgresDialect,
    serialised: false,
    connection: async () => {
      const client = await pool.connect();
      return {
        exec: async (sql) => {
          await client.query(sql);
        },
        all: async (sql, params) => {
          const result = await client.query(postgresDialect.bind(sql), [...params]);
          return result.rows as Row[];
        },
        run: async (sql, params) => {
          await client.query(postgresDialect.bind(sql), [...params]);
        },
        release: () => {
          client.release();
        },
      };
    },
    close: async () => {
      await pool.end();
    },
  };
}
