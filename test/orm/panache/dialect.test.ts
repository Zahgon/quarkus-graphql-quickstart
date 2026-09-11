/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { dialectFor, postgresDialect, sqliteDialect } from '../../../src/orm/panache/dialect.js';

/**
 * A test the original does not have.
 *
 * Hibernate chose a `Dialect` from `quarkus.datasource.db-kind` and generated
 * the SQL for it; the port does the same for the two kinds this project
 * declares. The differences are small and easy to get wrong, so each one is
 * pinned here rather than left to an integration run against a live server.
 */
describe('DialectTest', () => {
  it('dialectFor_selectsTheKindTheDatasourceDeclares', () => {
    expect(dialectFor('h2')).toBe(sqliteDialect);
    expect(dialectFor('postgresql')).toBe(postgresDialect);
    expect(() => dialectFor('mariadb')).toThrow("Unsupported datasource db-kind 'mariadb'");
  });

  it('bind_leavesTheInMemoryMarkersAlone', () => {
    expect(sqliteDialect.bind('SELECT * FROM book WHERE id = ? AND isbn = ?')).toBe(
      'SELECT * FROM book WHERE id = ? AND isbn = ?',
    );
  });

  it('bind_numbersThePostgresMarkersPositionally', () => {
    expect(postgresDialect.bind('SELECT * FROM book WHERE id = ? AND isbn = ?')).toBe(
      'SELECT * FROM book WHERE id = $1 AND isbn = $2',
    );
    expect(postgresDialect.bind('SELECT 1')).toBe('SELECT 1');
  });

  it('columnType_mapsTheThreeStorageClasses', () => {
    for (const dialect of [sqliteDialect, postgresDialect]) {
      expect(dialect.columnType('integer', undefined)).toBe('INTEGER');
      expect(dialect.columnType('date', undefined)).toBe('DATE');
      expect(dialect.columnType('string', 60)).toBe('VARCHAR(60)');
      expect(dialect.columnType('string', undefined)).toBe('VARCHAR(255)');
    }
  });
});
