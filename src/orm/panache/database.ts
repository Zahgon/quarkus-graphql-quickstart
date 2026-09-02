/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { RESOURCES_ROOT } from '../../config/application-properties.js';
import { logger } from '../../deps/log.js';
import type { Dialect } from './dialect.js';
import type { Connection, Row, SqlValue } from './driver.js';
import type { EntityMetadata } from './metadata.js';
import { entityMetadata } from './metadata.js';

export type { Row, SqlValue } from './driver.js';

// `quarkus.hibernate-orm.log.sql=true` raises this category to DEBUG.
const log = logger('org.hibernate.SQL');

/**
 * One connection's worth of the relational store, with the statement logging
 * `quarkus.hibernate-orm.log.sql` controls.
 *
 * The original runs Hibernate ORM against an in-memory H2 outside `%prod` and
 * against PostgreSQL inside it. Both are supported here through the driver the
 * persistence unit selected from `quarkus.datasource.db-kind`; nothing above
 * this class knows which one it is talking to.
 */
export class Database {
  constructor(
    private readonly connection: Connection,
    readonly dialect: Dialect,
  ) {}

  async exec(sql: string): Promise<void> {
    log.debugf('%s', sql.trim());
    await this.connection.exec(sql);
  }

  async all(sql: string, params: readonly SqlValue[] = []): Promise<Row[]> {
    log.debugf('%s', sql);
    return await this.connection.all(this.dialect.bind(sql), params);
  }

  async get(sql: string, params: readonly SqlValue[] = []): Promise<Row | undefined> {
    const rows = await this.all(sql, params);
    return rows[0];
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<void> {
    log.debugf('%s', sql);
    await this.connection.run(this.dialect.bind(sql), params);
  }

  /** Claims the next identifier from an entity's Hibernate sequence. */
  async nextSequenceValue(sequence: string): Promise<number> {
    const row = await this.get(`SELECT next_val FROM ${sequence}`);
    const current = Number(row?.['next_val'] ?? 1);
    await this.run(`UPDATE ${sequence} SET next_val = ?`, [current + 1]);
    return current;
  }
}

/**
 * Orders the entities so that a table is always created after every table it
 * references, which is what lets the foreign keys be declared inline.
 */
function inCreationOrder(all: readonly EntityMetadata[]): EntityMetadata[] {
  const ordered: EntityMetadata[] = [];
  const seen = new Set<string>();

  const visit = (metadata: EntityMetadata): void => {
    if (seen.has(metadata.name)) {
      return;
    }
    seen.add(metadata.name);
    for (const association of metadata.manyToOne) {
      visit(association.target());
    }
    ordered.push(metadata);
  };

  for (const metadata of all) {
    visit(metadata);
  }
  return ordered;
}

/**
 * `quarkus.hibernate-orm.database.generation=drop-and-create`: derives the
 * schema from the mappings and recreates it from scratch.
 */
export async function createSchema(database: Database): Promise<void> {
  const all = inCreationOrder(entityMetadata());
  const { columnType } = database.dialect;

  for (const metadata of [...all].reverse()) {
    for (const collection of metadata.elementCollections) {
      await database.exec(`DROP TABLE IF EXISTS ${collection.table}`);
    }
    for (const association of metadata.manyToMany) {
      await database.exec(`DROP TABLE IF EXISTS ${association.joinTable}`);
    }
    await database.exec(`DROP TABLE IF EXISTS ${metadata.table}`);
    await database.exec(`DROP TABLE IF EXISTS ${metadata.sequence}`);
  }

  for (const metadata of all) {
    const definitions: string[] = ['id INTEGER NOT NULL PRIMARY KEY'];
    for (const column of metadata.columns) {
      definitions.push(
        `${column.column} ${columnType(column.type, column.length)}` +
          (column.nullable ? '' : ' NOT NULL'),
      );
    }
    for (const association of metadata.manyToOne) {
      const target = association.target();
      definitions.push(
        `${association.joinColumn} INTEGER REFERENCES ${target.table}(id)`,
      );
    }
    await database.exec(`CREATE TABLE ${metadata.table} (\n  ${definitions.join(',\n  ')}\n)`);

    // Hibernate gives every entity its own identifier sequence, `<table>_seq`.
    await database.exec(`CREATE TABLE ${metadata.sequence} (next_val INTEGER NOT NULL)`);
    await database.run(`INSERT INTO ${metadata.sequence} (next_val) VALUES (?)`, [1]);
  }

  for (const metadata of all) {
    for (const collection of metadata.elementCollections) {
      await database.exec(
        `CREATE TABLE ${collection.table} (\n` +
          `  ${collection.joinColumn} INTEGER NOT NULL REFERENCES ${metadata.table}(id),\n` +
          `  ${collection.column} ${columnType('string', collection.length)}` +
          `${collection.nullable ? '' : ' NOT NULL'}\n)`,
      );
    }
    for (const association of metadata.manyToMany) {
      const target = association.target();
      await database.exec(
        `CREATE TABLE ${association.joinTable} (\n` +
          `  ${association.joinColumn} INTEGER NOT NULL REFERENCES ${metadata.table}(id),\n` +
          `  ${association.inverseJoinColumn} INTEGER NOT NULL REFERENCES ${target.table}(id)\n)`,
      );
    }
  }
}

/**
 * Splits a script into statements, ignoring `--` comments and semicolons that
 * sit inside a quoted literal.
 */
export function splitStatements(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < script.length; index += 1) {
    const character = script[index] as string;

    if (!inString && character === '-' && script[index + 1] === '-') {
      while (index < script.length && script[index] !== '\n') {
        index += 1;
      }
      current += '\n';
      continue;
    }
    if (character === "'") {
      // `''` is an escaped quote inside a literal, not the end of it.
      if (inString && script[index + 1] === "'") {
        current += "''";
        index += 1;
        continue;
      }
      inString = !inString;
      current += character;
      continue;
    }
    if (character === ';' && !inString) {
      statements.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  statements.push(current);

  return statements.map((statement) => statement.trim()).filter((statement) => statement !== '');
}

/**
 * `quarkus.hibernate-orm.sql-load-script`: runs the seed script against the
 * freshly created schema.
 *
 * `ALTER SEQUENCE <name> RESTART WITH <n>` is H2 and PostgreSQL syntax for a
 * real sequence object. The sequences here are ordinary tables, so the
 * statement is translated into the update it stands for — the seed script
 * itself is never edited.
 */
export async function runLoadScript(database: Database, scriptPath: string): Promise<void> {
  const script = readFileSync(resolve(RESOURCES_ROOT, scriptPath), 'utf8');

  for (const statement of splitStatements(script)) {
    const alterSequence = /^ALTER\s+SEQUENCE\s+(\w+)\s+RESTART\s+WITH\s+(\d+)$/i.exec(statement);
    if (alterSequence !== null) {
      const [, sequence, value] = alterSequence as unknown as [string, string, string];
      await database.run(`UPDATE ${sequence.toLowerCase()} SET next_val = ?`, [Number(value)]);
      continue;
    }
    await database.exec(statement);
  }
}
