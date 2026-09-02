/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import { applicationProperties } from '../../config/application-properties.js';
import { Database, createSchema, runLoadScript } from './database.js';
import { dialectFor } from './dialect.js';
import type { Connection, Driver } from './driver.js';
import { createInMemoryDriver, createPostgresDriver, parseJdbcPostgresUrl } from './driver.js';
import { EntityManager } from './entity-manager.js';
import type { EntityMetadata } from './metadata.js';

/**
 * The persistence unit and the session that scopes it.
 *
 * Quarkus injects a `@RequestScoped` `EntityManager` whose persistence context
 * lives for one transaction, over a connection Agroal checks out for the
 * request. `AsyncLocalStorage` gives the same ambient scoping in Node without
 * threading a handle through every call.
 */

interface Session {
  entityManager: EntityManager | null;
  connection: Connection | null;
  transactionDepth: number;
}

const storage = new AsyncLocalStorage<Session>();

let driver: Driver | null = null;

/**
 * How many application instances hold the persistence unit open.
 *
 * Quarkus scopes the persistence unit to the application, and there is exactly
 * one application per JVM. Node can hold several in a single process, so the
 * unit is shared and closed only when the last one lets go.
 */
let references = 0;

/** Builds the datasource `quarkus.datasource.db-kind` names. */
export function createDriver(): Driver {
  const datasource = applicationProperties.datasource;
  switch (dialectFor(datasource.dbKind).name) {
    case 'postgresql':
      return createPostgresDriver({
        ...parseJdbcPostgresUrl(datasource.url),
        user: datasource.username,
        password: datasource.password,
        maxSize: datasource.maxSize,
      });
    default:
      return createInMemoryDriver();
  }
}

/**
 * Boots the persistence unit: creates the schema from the mappings
 * (`database.generation=drop-and-create`) and runs the seed script
 * (`sql-load-script=sample_data.sql`).
 */
export async function startPersistenceUnit(): Promise<void> {
  references += 1;
  if (driver !== null) {
    return;
  }
  const started = createDriver();
  const connection = await started.connection();
  try {
    const database = new Database(connection, started.dialect);
    if (applicationProperties.hibernateOrm.databaseGeneration === 'drop-and-create') {
      await createSchema(database);
    }
    if (applicationProperties.hibernateOrm.sqlLoadScript !== '') {
      await runLoadScript(database, applicationProperties.hibernateOrm.sqlLoadScript);
    }
  } catch (error) {
    references -= 1;
    await started.close();
    throw error;
  } finally {
    connection.release();
  }
  driver = started;
}

export async function stopPersistenceUnit(): Promise<void> {
  references = Math.max(0, references - 1);
  if (references > 0) {
    return;
  }
  const closing = driver;
  driver = null;
  await closing?.close();
}

function requireDriver(): Driver {
  if (driver === null) {
    throw new Error('The persistence unit has not been started');
  }
  return driver;
}

function newSession(): Session {
  return { entityManager: null, connection: null, transactionDepth: 0 };
}

/** The `EntityManager` bound to the current session, opening a connection on demand. */
export async function currentEntityManager(): Promise<EntityManager> {
  const session = storage.getStore();
  if (session === undefined) {
    throw new Error(
      'No persistence session is active; wrap the call in runInSession or transactional',
    );
  }
  if (session.entityManager === null) {
    const connection = await requireDriver().connection();
    session.connection = connection;
    session.entityManager = new EntityManager(new Database(connection, requireDriver().dialect));
  }
  return session.entityManager;
}

/** Hands the session's connection back to the pool, as the request ending does. */
export function releaseSession(): void {
  const session = storage.getStore();
  if (session === undefined) {
    return;
  }
  session.connection?.release();
  session.connection = null;
  session.entityManager = null;
}

/**
 * Enters a fresh persistence context and hands control to `next`.
 *
 * Fastify runs the rest of the request from inside the `done()` callback of an
 * `onRequest` hook, so calling it within `AsyncLocalStorage.run` puts the whole
 * request — hooks, handler and serialiser — in the same context. That is how
 * the request-scoped `EntityManager` of the original is reproduced.
 */
export function enterSession(next: () => void): void {
  storage.run(newSession(), next);
}

/** Runs `action` with a fresh persistence context, as Quarkus does per request. */
export async function runInSession<T>(action: () => T | Promise<T>): Promise<T> {
  if (storage.getStore() !== undefined) {
    return await action();
  }
  const session = newSession();
  return await storage.run(session, async () => {
    try {
      return await action();
    } finally {
      session.connection?.release();
      session.connection = null;
      session.entityManager = null;
    }
  });
}

/**
 * Overlapping transactions are queued when — and only when — the datasource is
 * a single connection.
 *
 * The in-memory engine has exactly one, so without this two interleaved
 * requests would nest a `BEGIN` inside another and see each other's uncommitted
 * rows. PostgreSQL hands each session its own connection out of the pool, which
 * is what the original's Agroal pool does, so nothing needs queueing there.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(action: () => Promise<T>): Promise<T> {
  if (!requireDriver().serialised) {
    return action();
  }
  const result = queue.then(action, action);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function runTransaction<T>(session: Session, action: () => T | Promise<T>): Promise<T> {
  const entityManager = await currentEntityManager();
  const connection = session.connection as Connection;
  session.transactionDepth += 1;
  await connection.exec('BEGIN');
  try {
    const result = await action();
    await entityManager.flush();
    await connection.exec('COMMIT');
    return result;
  } catch (error) {
    await connection.exec('ROLLBACK');
    entityManager.clear();
    throw error;
  } finally {
    session.transactionDepth -= 1;
  }
}

/**
 * `jakarta.transaction.Transactional` with the default `REQUIRED` propagation:
 * joins the caller's transaction when there is one, starts one otherwise.
 */
export async function transactional<T>(action: () => T | Promise<T>): Promise<T> {
  const existing = storage.getStore();
  if (existing !== undefined && existing.transactionDepth > 0) {
    return await action();
  }
  if (existing !== undefined) {
    return await enqueue(() => runTransaction(existing, action));
  }
  const session = newSession();
  return await enqueue(() =>
    storage.run(session, async () => {
      try {
        return await runTransaction(session, action);
      } finally {
        session.connection?.release();
        session.connection = null;
        session.entityManager = null;
      }
    }),
  );
}

/**
 * The injected `EntityManager`.
 *
 * CDI hands out a proxy that resolves to the request's real instance on every
 * call; this object does the same through the ambient session.
 */
export const entityManager = {
  async persist(entity: object): Promise<void> {
    await (await currentEntityManager()).persist(entity);
  },
  async merge<T extends object>(entity: T): Promise<T> {
    return await (await currentEntityManager()).merge(entity);
  },
  async remove(entity: object): Promise<void> {
    (await currentEntityManager()).remove(entity);
  },
  async find<T extends object>(
    entityClass: { metadata: EntityMetadata },
    id: number | null | undefined,
  ): Promise<T | null> {
    return await (await currentEntityManager()).find<T>(entityClass, id);
  },
  async flush(): Promise<void> {
    await (await currentEntityManager()).flush();
  },
};

export type InjectedEntityManager = typeof entityManager;
