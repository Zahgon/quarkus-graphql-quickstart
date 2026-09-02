/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import {
  createInMemoryDriver,
  createPostgresDriver,
  parseJdbcPostgresUrl,
} from '../../../src/orm/panache/driver.js';

/**
 * A test the original does not have: Agroal parsed the JDBC URL and handed out
 * connections. The port does both, for the two datasources
 * `application.properties` declares.
 */
describe('DriverTest', () => {
  it('parseJdbcPostgresUrl_readsTheHostPortAndDatabase', () => {
    expect(parseJdbcPostgresUrl('jdbc:postgresql://postgres:5432/quarkus')).toEqual({
      host: 'postgres',
      port: 5432,
      database: 'quarkus',
    });
    expect(parseJdbcPostgresUrl('postgresql://db.example.com/catalogue')).toEqual({
      host: 'db.example.com',
      port: 5432,
      database: 'catalogue',
    });
  });

  it('parseJdbcPostgresUrl_rejectsAUrlForAnotherDatabase', () => {
    expect(() =>
      parseJdbcPostgresUrl('jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1'),
    ).toThrow('Not a PostgreSQL JDBC URL');
    expect(() => parseJdbcPostgresUrl('jdbc:mysql://localhost/quarkus')).toThrow(
      'Not a PostgreSQL JDBC URL',
    );
  });

  it('inMemoryDriver_isASingleSerialisedConnection', async () => {
    const driver = createInMemoryDriver();
    expect(driver.serialised).toBe(true);
    expect(driver.dialect.name).toBe('h2');

    const connection = await driver.connection();
    await connection.exec('CREATE TABLE probe (value VARCHAR(16) NOT NULL)');
    await connection.run('INSERT INTO probe (value) VALUES (?)', ['stored']);
    expect(await connection.all('SELECT value FROM probe', [])).toEqual([{ value: 'stored' }]);

    // One connection, handed out again rather than opened a second time.
    expect(await driver.connection()).toBe(connection);
    connection.release();
    await driver.close();
  });

  it('postgresDriver_reportsAClearFailureWhenTheServerIsUnreachable', async () => {
    const driver = createPostgresDriver({
      host: '127.0.0.1',
      // Port 1 is reserved and never listening, so this is a connect failure
      // rather than a protocol one.
      port: 1,
      database: 'quarkus',
      user: 'quarkus',
      password: 'quarkus',
      maxSize: 2,
    });
    expect(driver.serialised).toBe(false);
    expect(driver.dialect.name).toBe('postgresql');

    await expect(driver.connection()).rejects.toThrow();
    await driver.close();
  });
});
