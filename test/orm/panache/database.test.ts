/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import {
  createSchema,
  Database,
  runLoadScript,
  splitStatements,
} from '../../../src/orm/panache/database.js';
import { createInMemoryDriver } from '../../../src/orm/panache/driver.js';
import '../../../src/orm/panache/entity/book.js';

/**
 * A test the original does not have.
 *
 * Splitting `sql-load-script` into statements was the JDBC layer's job. The
 * port does it, and `sample_data.sql` contains both `--` comments and quoted
 * literals, so getting the split wrong would corrupt the seed data.
 */
describe('DatabaseTest', () => {
  it('splitStatements_splitsOnSemicolonsAndDropsBlanks', () => {
    expect(splitStatements('INSERT INTO editor VALUES (1);\nINSERT INTO editor VALUES (2);\n')).toEqual([
      'INSERT INTO editor VALUES (1)',
      'INSERT INTO editor VALUES (2)',
    ]);
  });

  it('splitStatements_ignoresLineComments', () => {
    expect(
      splitStatements('-- Insert into editor (publisher)\nINSERT INTO editor VALUES (3);'),
    ).toEqual(['INSERT INTO editor VALUES (3)']);
  });

  it('splitStatements_keepsSemicolonsInsideALiteral', () => {
    expect(splitStatements("INSERT INTO book VALUES ('a; b');")).toEqual([
      "INSERT INTO book VALUES ('a; b')",
    ]);
  });

  it('splitStatements_keepsAnEscapedQuoteInsideALiteral', () => {
    expect(splitStatements("INSERT INTO book VALUES ('l''arte');")).toEqual([
      "INSERT INTO book VALUES ('l''arte')",
    ]);
  });
});

/**
 * A test the original does not have: creating the schema from the mappings
 * (`database.generation=drop-and-create`), running the seed script and closing
 * the unit down again were Hibernate's and the JDBC pool's responsibilities.
 */
describe('DatabaseLifecycleTest', () => {
  it('createSchema_andRunLoadScript_seedTheMappedTables', async () => {
    const driver = createInMemoryDriver();
    const connection = await driver.connection();
    try {
      const database = new Database(connection, driver.dialect);
      await createSchema(database);
      await runLoadScript(database, 'sample_data.sql');

      expect((await database.get('SELECT COUNT(*) AS total FROM editor'))?.['total']).toBe(15);
      expect((await database.get('SELECT COUNT(*) AS total FROM book'))?.['total']).toBe(15);
      expect((await database.get('SELECT COUNT(*) AS total FROM author'))?.['total']).toBe(14);
      expect((await database.get('SELECT COUNT(*) AS total FROM book_authors'))?.['total']).toBe(
        26,
      );

      // `ALTER SEQUENCE … RESTART WITH 50` keeps generated ids clear of the seeds.
      expect(await database.nextSequenceValue('book_seq')).toBe(50);
      expect(await database.nextSequenceValue('book_seq')).toBe(51);
    } finally {
      connection.release();
      await driver.close();
    }
  });
});
