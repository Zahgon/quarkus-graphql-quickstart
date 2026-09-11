/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Database, createSchema, runLoadScript } from '../../../src/orm/panache/database.js';
import { createPostgresDriver, parseJdbcPostgresUrl } from '../../../src/orm/panache/driver.js';
import { EntityManager } from '../../../src/orm/panache/entity-manager.js';
import { Author } from '../../../src/orm/panache/entity/author.js';
import { Book } from '../../../src/orm/panache/entity/book.js';
import { Editor } from '../../../src/orm/panache/entity/editor.js';
import { LocalDate } from '../../../src/orm/panache/local-date.js';

/**
 * A test the original does not have, against the datasource `%prod` declares.
 *
 * Everything else in this suite runs on the in-memory engine that stands in for
 * H2. This one drives the same mapping engine against a real PostgreSQL, which
 * is the only way to prove the dialect's placeholders, its `ctid` ordering and
 * its `DATE` handling are right.
 *
 * It needs a server. `docker compose -f src/main/docker/docker-compose.yml up
 * postgres` provides one; `DB_URL`, `DB_USERNAME` and `DB_PASSWORD` point at
 * another. Without one the whole block is skipped rather than failed — the
 * default profile does not use PostgreSQL, so an ordinary `npm test` should not
 * require it.
 *
 * `host.docker.internal` is tried as well as `127.0.0.1`, so the suite finds a
 * server on the host when it is itself running inside a container.
 */
const user = process.env['DB_USERNAME'] ?? 'quarkus';
const password = process.env['DB_PASSWORD'] ?? 'quarkus';

const candidates = [
  process.env['DB_URL'],
  'jdbc:postgresql://127.0.0.1:5432/quarkus',
  'jdbc:postgresql://host.docker.internal:5432/quarkus',
].filter((candidate): candidate is string => candidate !== undefined);

async function reachable(candidate: string): Promise<boolean> {
  const driver = createPostgresDriver({
    ...parseJdbcPostgresUrl(candidate),
    user,
    password,
    maxSize: 1,
  });
  try {
    (await driver.connection()).release();
    return true;
  } catch {
    return false;
  } finally {
    await driver.close();
  }
}

async function firstReachable(): Promise<string | null> {
  for (const candidate of candidates) {
    if (await reachable(candidate)) {
      return candidate;
    }
  }
  return null;
}

const jdbcUrl = await firstReachable();
const available = jdbcUrl !== null;

describe.skipIf(!available)('PostgresIntegrationTest', () => {
  it('theMappingEngineRunsUnchangedAgainstPostgreSQL', async () => {
    const driver = createPostgresDriver({
      ...parseJdbcPostgresUrl(jdbcUrl as string),
      user,
      password,
      maxSize: 4,
    });
    const connection = await driver.connection();
    try {
      const database = new Database(connection, driver.dialect);
      await createSchema(database);
      await runLoadScript(database, 'sample_data.sql');

      const entityManager = new EntityManager(database);

      // The seed script loaded, and `ALTER SEQUENCE … RESTART WITH 50` was
      // honoured, so a generated identifier clears the seeded ones.
      expect(await entityManager.count(Book.metadata)).toBe(15);
      expect(await entityManager.count(Author.metadata)).toBe(14);
      expect(await entityManager.count(Editor.metadata)).toBe(15);
      expect(await database.nextSequenceValue('book_seq')).toBe(50);

      // A DATE column comes back as ISO-8601 text, not as a shifted Date.
      const book = (await entityManager.find<Book>(Book, 3)) as Book;
      expect(book.publication).toBe('2022-11-05');
      expect(book.title).toBe('Networked neural strategy');

      // Element collections and the join table keep their insertion order.
      expect(book.languages).toEqual(['eng', 'deu']);
      expect(book.formats).toEqual(['EPUB', 'MOBI']);
      expect(book.authors?.map((author) => author.id)).toEqual([3, 4]);
      expect(book.editor?.name).toBe('Global Tech Publications');

      // A round trip through insert, dirty checking and delete.
      await connection.exec('BEGIN');
      const created = new Book();
      created.title = 'Written to PostgreSQL';
      created.isbn = '1111111111111';
      created.pages = 42;
      created.summary = 'Round trip';
      created.publication = LocalDate.of(2025, 3, 4);
      created.genre = 'Integration';
      created.languages = ['eng'];
      const editor = new Editor();
      editor.name = 'PostgreSQL Editor';
      created.editor = editor;
      await entityManager.persist(created);
      await entityManager.flush();
      await connection.exec('COMMIT');

      expect(created.id).toBeGreaterThanOrEqual(50);

      await connection.exec('BEGIN');
      const reloaded = (await entityManager.find<Book>(Book, created.id)) as Book;
      reloaded.genre = 'Rewritten';
      await entityManager.flush();
      await connection.exec('COMMIT');

      const rows = await database.all('SELECT genre FROM book WHERE id = ?', [
        created.id as number,
      ]);
      expect(rows[0]?.['genre']).toBe('Rewritten');

      await connection.exec('BEGIN');
      entityManager.remove(reloaded);
      await entityManager.flush();
      await connection.exec('COMMIT');

      expect(await entityManager.find<Book>(Book, created.id)).toBeNull();
      // CascadeType.ALL took the editor with it.
      expect(await entityManager.find<Editor>(Editor, editor.id)).toBeNull();

      // Referential integrity is enforced, which is what makes DELETE
      // /api/authors/8 a 500 rather than a silent success.
      await connection.exec('BEGIN');
      await expect(
        database.run('DELETE FROM author WHERE id = ?', [8]),
      ).rejects.toThrow();
      await connection.exec('ROLLBACK');
    } finally {
      connection.release();
      await driver.close();
    }
  });
});
