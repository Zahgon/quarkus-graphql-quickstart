/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { ConstraintViolationException } from '../../deps/bean-validation.js';
import type { Database, Row, SqlValue } from './database.js';
import type { EntityMetadata } from './metadata.js';
import { columnFor } from './metadata.js';

/** Any mapped instance, seen through the entity manager's eyes. */
export type Entity = Record<string, unknown> & { id: number | null };

interface Snapshot {
  readonly columns: Record<string, unknown>;
  readonly manyToOne: Record<string, number | null>;
  readonly manyToMany: Record<string, readonly number[]>;
  readonly elements: Record<string, readonly unknown[]>;
}

type Status = 'pending' | 'managed' | 'removed';

interface EntityState {
  readonly metadata: EntityMetadata;
  readonly entity: Entity;
  status: Status;
  snapshot: Snapshot | null;
}

function metadataOf(entity: object): EntityMetadata {
  const holder = entity.constructor as { metadata?: EntityMetadata };
  if (holder.metadata === undefined) {
    throw new TypeError(`${entity.constructor.name} is not a mapped entity`);
  }
  return holder.metadata;
}

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') {
    return value;
  }
  return String(value);
}

function sameList(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * `jakarta.persistence.EntityManager`, narrowed to what the application uses.
 *
 * The behaviour that matters — and the reason this is a hand-written shim
 * rather than a mapping onto an off-the-shelf TypeScript ORM — is the
 * **persistence context**: a first-level identity map in which `find` returns
 * the very instance that was handed to `persist`, together with whatever was
 * hung off it in memory, whether or not any of it reached the database. Several
 * of the original's tests assert on exactly that.
 *
 * Alongside it are the three other Hibernate behaviours the application leans
 * on: cascading (`CascadeType.PERSIST` / `ALL`), automatic dirty checking at
 * flush, and identifiers drawn from a per-entity sequence.
 *
 * Every operation that reaches the database is asynchronous. The original runs
 * on a thread-per-request model where a blocking JDBC call parks its own
 * thread; in Node the equivalent of parking a request is awaiting it.
 */
export class EntityManager {
  /** The persistence context: `entity name # id` → tracked state. */
  private readonly identityMap = new Map<string, EntityState>();

  /** Insertion order matters: a parent row has to exist before its children. */
  private readonly pendingInserts: EntityState[] = [];

  private readonly pendingRemovals: EntityState[] = [];

  constructor(private readonly database: Database) {}

  private key(metadata: EntityMetadata, id: number): string {
    return `${metadata.name}#${id}`;
  }

  private stateOf(entity: object): EntityState | undefined {
    const metadata = metadataOf(entity);
    const id = (entity as Entity).id;
    if (id === null || id === undefined) {
      return this.pendingInserts.find((state) => state.entity === entity);
    }
    const tracked = this.identityMap.get(this.key(metadata, id));
    return tracked?.entity === entity ? tracked : undefined;
  }

  /**
   * `EntityManager.persist` — makes a transient instance managed, assigning it
   * an identifier straight away (Hibernate can, because the id comes from a
   * sequence rather than from the insert) and cascading to the associations
   * that ask for it.
   */
  async persist(entity: object): Promise<void> {
    const metadata = metadataOf(entity);
    const target = entity as Entity;

    if (this.stateOf(entity) !== undefined) {
      // Already managed: `persist` on a managed instance is a no-op in JPA.
      return;
    }

    for (const association of metadata.manyToOne) {
      const related = target[association.property];
      if (related !== null && related !== undefined && association.cascade.includes('PERSIST')) {
        await this.cascadePersist(related as Entity);
      }
    }
    for (const association of metadata.manyToMany) {
      const related = target[association.property];
      if (Array.isArray(related) && association.cascade.includes('PERSIST')) {
        for (const item of related as Entity[]) {
          await this.cascadePersist(item);
        }
      }
    }

    if (target.id === null || target.id === undefined) {
      target.id = await this.database.nextSequenceValue(metadata.sequence);
    }

    const state: EntityState = { metadata, entity: target, status: 'pending', snapshot: null };
    this.pendingInserts.push(state);
    this.identityMap.set(this.key(metadata, target.id), state);
  }

  private async cascadePersist(related: Entity): Promise<void> {
    if (related.id === null || related.id === undefined) {
      await this.persist(related);
      return;
    }
    // An instance that already carries an identifier denotes an existing row,
    // so persist inserts nothing. Resolving it brings the real state into the
    // context: `{ "authors": [{ "id": 5 }] }` deserialises to a placeholder
    // carrying an identifier and nothing else, and the association has to be
    // written against the row it names.
    const metadata = metadataOf(related);
    if (!this.identityMap.has(this.key(metadata, related.id))) {
      if ((await this.find({ metadata }, related.id)) === null) {
        this.adopt(metadata, related);
      }
    }
  }

  /** Brings an already-identified instance into the context as managed. */
  private adopt(metadata: EntityMetadata, entity: Entity): EntityState {
    const state: EntityState = { metadata, entity, status: 'managed', snapshot: null };
    state.snapshot = this.snapshot(state);
    this.identityMap.set(this.key(metadata, entity.id as number), state);
    return state;
  }

  /**
   * `EntityManager.find` — the persistence context is consulted first, so the
   * instance that was persisted in this transaction comes back unchanged.
   */
  async find<T extends object>(
    entityClass: { metadata: EntityMetadata },
    id: number | null | undefined,
  ): Promise<T | null> {
    if (id === null || id === undefined) {
      return null;
    }
    const metadata = entityClass.metadata;
    const tracked = this.identityMap.get(this.key(metadata, id));
    if (tracked !== undefined) {
      return tracked.status === 'removed' ? null : (tracked.entity as T);
    }

    const row = await this.database.get(`SELECT * FROM ${metadata.table} WHERE id = ?`, [id]);
    if (row === undefined) {
      return null;
    }
    return (await this.materialise(metadata, row)) as T;
  }

  /** `EntityManager.merge` — copies detached state onto the managed instance. */
  async merge<T extends object>(entity: T): Promise<T> {
    const metadata = metadataOf(entity);
    const source = entity as unknown as Entity;

    if (this.stateOf(entity) !== undefined) {
      return entity;
    }
    if (source.id === null || source.id === undefined) {
      await this.persist(entity);
      return entity;
    }

    const managed = await this.find<T>({ metadata }, source.id);
    if (managed === null) {
      this.adopt(metadata, source);
      return entity;
    }

    const destination = managed as unknown as Entity;
    for (const column of metadata.columns) {
      destination[column.property] = source[column.property];
    }
    for (const association of metadata.manyToOne) {
      destination[association.property] = source[association.property];
    }
    for (const association of metadata.manyToMany) {
      destination[association.property] = source[association.property];
    }
    for (const collection of metadata.elementCollections) {
      destination[collection.property] = source[collection.property];
    }
    return managed;
  }

  /**
   * `EntityManager.remove` — scheduled, and applied at the next flush.
   *
   * `CascadeType.REMOVE` propagates: `Book.editor` is mapped with
   * `CascadeType.ALL`, so deleting a book deletes the editor it points at. The
   * owner is queued before the target, which is also the order the foreign keys
   * require.
   */
  remove(entity: object): void {
    const metadata = metadataOf(entity);
    const target = entity as Entity;
    if (target.id === null || target.id === undefined) {
      return;
    }
    const key = this.key(metadata, target.id);
    const state = this.identityMap.get(key) ?? this.adopt(metadata, target);
    if (state.status === 'removed') {
      return;
    }
    state.status = 'removed';
    this.pendingRemovals.push(state);

    for (const association of metadata.manyToOne) {
      const related = state.entity[association.property] as Entity | null | undefined;
      if (related !== null && related !== undefined && association.cascade.includes('REMOVE')) {
        this.remove(related);
      }
    }
    for (const association of metadata.manyToMany) {
      const related = state.entity[association.property];
      if (Array.isArray(related) && association.cascade.includes('REMOVE')) {
        for (const item of related as Entity[]) {
          this.remove(item);
        }
      }
    }
  }

  /** Detaches everything; the context is transaction-scoped in the original. */
  clear(): void {
    this.identityMap.clear();
    this.pendingInserts.length = 0;
    this.pendingRemovals.length = 0;
  }

  /**
   * `EntityManager.flush` — writes the pending inserts, the changes automatic
   * dirty checking has found, and the pending removals, in that order.
   */
  async flush(): Promise<void> {
    await this.cascadeFromManaged();

    while (this.pendingInserts.length > 0) {
      const state = this.pendingInserts.shift() as EntityState;
      await this.insert(state);
    }

    for (const state of this.identityMap.values()) {
      if (state.status === 'managed') {
        await this.update(state);
      }
    }

    while (this.pendingRemovals.length > 0) {
      const state = this.pendingRemovals.shift() as EntityState;
      await this.delete(state);
    }
  }

  /**
   * Cascades `PERSIST` from managed entities at flush time.
   *
   * Assigning a *new* instance to a cascading association on an entity that is
   * already managed — as `BookResource.update` does with the editor — has to
   * insert that instance before the owner's foreign key can point at it.
   */
  private async cascadeFromManaged(): Promise<void> {
    for (const state of [...this.identityMap.values()]) {
      if (state.status !== 'managed') {
        continue;
      }
      for (const association of state.metadata.manyToOne) {
        const related = state.entity[association.property] as Entity | null | undefined;
        if (
          related !== null &&
          related !== undefined &&
          (related.id === null || related.id === undefined) &&
          association.cascade.includes('PERSIST')
        ) {
          await this.persist(related);
        }
      }
      for (const association of state.metadata.manyToMany) {
        const related = state.entity[association.property];
        if (!Array.isArray(related) || !association.cascade.includes('PERSIST')) {
          continue;
        }
        for (const item of related as Entity[]) {
          if (item.id === null || item.id === undefined) {
            await this.persist(item);
          }
        }
      }
    }
  }

  /** Hibernate Validator runs on pre-insert and pre-update. */
  private validate(state: EntityState): void {
    for (const column of state.metadata.columns) {
      const value = state.entity[column.property];
      if (!column.nullable && (value === null || value === undefined)) {
        throw new ConstraintViolationException(
          `${state.metadata.name}.${column.property}: must not be null`,
        );
      }
      if (column.pattern !== undefined && typeof value === 'string') {
        if (!column.pattern.regexp.test(value)) {
          throw new ConstraintViolationException(
            `${state.metadata.name}.${column.property}: ${column.pattern.message}`,
          );
        }
      }
    }
  }

  private async insert(state: EntityState): Promise<void> {
    this.validate(state);
    const { metadata, entity } = state;

    const columns: string[] = ['id'];
    const values: SqlValue[] = [entity.id as number];

    for (const column of metadata.columns) {
      columns.push(column.column);
      values.push(toSqlValue(entity[column.property]));
    }
    for (const association of metadata.manyToOne) {
      const related = entity[association.property] as Entity | null | undefined;
      columns.push(association.joinColumn);
      values.push(related?.id ?? null);
    }

    await this.database.run(
      `INSERT INTO ${metadata.table} (${columns.join(', ')}) ` +
        `VALUES (${columns.map(() => '?').join(', ')})`,
      values,
    );

    await this.writeCollections(state);
    state.status = 'managed';
    state.snapshot = this.snapshot(state);
  }

  private async update(state: EntityState): Promise<void> {
    const { metadata, entity } = state;
    const previous = state.snapshot;
    if (previous === null) {
      return;
    }
    const current = this.snapshot(state);

    const assignments: string[] = [];
    const values: SqlValue[] = [];
    for (const column of metadata.columns) {
      if (current.columns[column.property] !== previous.columns[column.property]) {
        assignments.push(`${column.column} = ?`);
        values.push(toSqlValue(entity[column.property]));
      }
    }
    for (const association of metadata.manyToOne) {
      if (current.manyToOne[association.property] !== previous.manyToOne[association.property]) {
        assignments.push(`${association.joinColumn} = ?`);
        values.push(current.manyToOne[association.property] ?? null);
      }
    }

    if (assignments.length > 0) {
      this.validate(state);
      values.push(entity.id as number);
      await this.database.run(
        `UPDATE ${metadata.table} SET ${assignments.join(', ')} WHERE id = ?`,
        values,
      );
    }

    // Hibernate rewrites a changed bag wholesale rather than diffing it.
    for (const collection of metadata.elementCollections) {
      const before = previous.elements[collection.property] ?? [];
      const after = current.elements[collection.property] ?? [];
      if (!sameList(before, after)) {
        await this.database.run(
          `DELETE FROM ${collection.table} WHERE ${collection.joinColumn} = ?`,
          [entity.id as number],
        );
        await this.writeElementCollection(state, collection.property);
      }
    }
    for (const association of metadata.manyToMany) {
      const before = previous.manyToMany[association.property] ?? [];
      const after = current.manyToMany[association.property] ?? [];
      if (!sameList(before, after)) {
        await this.database.run(
          `DELETE FROM ${association.joinTable} WHERE ${association.joinColumn} = ?`,
          [entity.id as number],
        );
        await this.writeManyToMany(state, association.property);
      }
    }

    state.snapshot = current;
  }

  private async delete(state: EntityState): Promise<void> {
    const { metadata, entity } = state;
    const id = entity.id as number;

    // The owning side of an association is cleaned up with its owner; the
    // inverse side is not, which is what makes a still-referenced row fail.
    for (const collection of metadata.elementCollections) {
      await this.database.run(
        `DELETE FROM ${collection.table} WHERE ${collection.joinColumn} = ?`,
        [id],
      );
    }
    for (const association of metadata.manyToMany) {
      await this.database.run(
        `DELETE FROM ${association.joinTable} WHERE ${association.joinColumn} = ?`,
        [id],
      );
    }
    await this.database.run(`DELETE FROM ${metadata.table} WHERE id = ?`, [id]);
    this.identityMap.delete(this.key(metadata, id));
  }

  private async writeCollections(state: EntityState): Promise<void> {
    for (const collection of state.metadata.elementCollections) {
      await this.writeElementCollection(state, collection.property);
    }
    for (const association of state.metadata.manyToMany) {
      await this.writeManyToMany(state, association.property);
    }
  }

  private async writeElementCollection(state: EntityState, property: string): Promise<void> {
    const collection = state.metadata.elementCollections.find(
      (candidate) => candidate.property === property,
    );
    if (collection === undefined) {
      return;
    }
    const values = state.entity[property];
    if (!Array.isArray(values)) {
      return;
    }
    for (const value of values as unknown[]) {
      await this.database.run(
        `INSERT INTO ${collection.table} (${collection.joinColumn}, ${collection.column}) VALUES (?, ?)`,
        [state.entity.id as number, toSqlValue(value)],
      );
    }
  }

  private async writeManyToMany(state: EntityState, property: string): Promise<void> {
    const association = state.metadata.manyToMany.find(
      (candidate) => candidate.property === property,
    );
    if (association === undefined) {
      return;
    }
    const related = state.entity[property];
    if (!Array.isArray(related)) {
      return;
    }
    for (const item of related as Entity[]) {
      await this.database.run(
        `INSERT INTO ${association.joinTable} ` +
          `(${association.joinColumn}, ${association.inverseJoinColumn}) VALUES (?, ?)`,
        [state.entity.id as number, item.id as number],
      );
    }
  }

  private snapshot(state: EntityState): Snapshot {
    const { metadata, entity } = state;
    const columns: Record<string, unknown> = {};
    for (const column of metadata.columns) {
      columns[column.property] = entity[column.property] ?? null;
    }
    const manyToOne: Record<string, number | null> = {};
    for (const association of metadata.manyToOne) {
      const related = entity[association.property] as Entity | null | undefined;
      manyToOne[association.property] = related?.id ?? null;
    }
    const manyToMany: Record<string, readonly number[]> = {};
    for (const association of metadata.manyToMany) {
      const related = entity[association.property];
      manyToMany[association.property] = Array.isArray(related)
        ? (related as Entity[]).map((item) => item.id as number)
        : [];
    }
    const elements: Record<string, readonly unknown[]> = {};
    for (const collection of metadata.elementCollections) {
      const values = entity[collection.property];
      elements[collection.property] = Array.isArray(values) ? [...(values as unknown[])] : [];
    }
    return { columns, manyToOne, manyToMany, elements };
  }

  /**
   * Turns a result-set row into a managed entity.
   *
   * Owned associations are fetched with the entity. Hibernate would defer them
   * until first touch, but the session stays open for the whole request, so the
   * only difference is how many statements run — never what a caller can see.
   * The inverse (`mappedBy`) sides are deliberately *not* fetched: that is what
   * keeps `Book → authors → books` from recursing.
   */
  async materialise(metadata: EntityMetadata, row: Row): Promise<Entity> {
    const existing = this.identityMap.get(this.key(metadata, Number(row['id'])));
    if (existing !== undefined) {
      return existing.entity;
    }

    const entity = metadata.newInstance() as Entity;
    entity.id = Number(row['id']);

    const state: EntityState = { metadata, entity, status: 'managed', snapshot: null };
    this.identityMap.set(this.key(metadata, entity.id), state);

    for (const column of metadata.columns) {
      const value = row[column.column];
      entity[column.property] =
        value === null || value === undefined
          ? null
          : column.type === 'integer'
            ? Number(value)
            : String(value);
    }

    for (const association of metadata.manyToOne) {
      const foreignKey = row[association.joinColumn];
      entity[association.property] =
        foreignKey === null || foreignKey === undefined
          ? null
          : await this.find({ metadata: association.target() }, Number(foreignKey));
    }

    for (const collection of metadata.elementCollections) {
      const rows = await this.database.all(
        `SELECT ${collection.column} AS value FROM ${collection.table} ` +
          `WHERE ${collection.joinColumn} = ?`,
        [entity.id],
      );
      entity[collection.property] = rows.map((element) => element['value']);
    }

    for (const association of metadata.manyToMany) {
      const rows = await this.database.all(
        `SELECT ${association.inverseJoinColumn} AS id FROM ${association.joinTable} ` +
          `WHERE ${association.joinColumn} = ?`,
        [entity.id],
      );
      const target = association.target();
      const related: Entity[] = [];
      for (const element of rows) {
        const item = await this.find<Entity>({ metadata: target }, Number(element['id']));
        if (item !== null) {
          related.push(item);
        }
      }
      entity[association.property] = related;
    }

    // A loaded entity always carries initialised collections, never `null` —
    // `book.authors.addAll(...)` in the original relies on it.
    for (const inverse of metadata.inverse) {
      entity[inverse.property] = [];
    }

    state.snapshot = this.snapshot(state);
    return entity;
  }

  private async materialiseAll(metadata: EntityMetadata, rows: Row[]): Promise<Entity[]> {
    const entities: Entity[] = [];
    for (const row of rows) {
      entities.push(await this.materialise(metadata, row));
    }
    return entities;
  }

  /** Every row of a table, in insertion order, as `Panache.listAll()` returns it. */
  async listAll(metadata: EntityMetadata): Promise<Entity[]> {
    return await this.materialiseAll(
      metadata,
      await this.database.all(`SELECT * FROM ${metadata.table}`),
    );
  }

  /** A slice of the table, `from`..`to` inclusive, as `PanacheQuery.range` is. */
  async range(metadata: EntityMetadata, from: number, to: number): Promise<Entity[]> {
    const limit = Math.max(0, to - from + 1);
    return await this.materialiseAll(
      metadata,
      await this.database.all(
        `SELECT * FROM ${metadata.table} LIMIT ? OFFSET ?`,
        [limit, from],
      ),
    );
  }

  async count(metadata: EntityMetadata): Promise<number> {
    const row = await this.database.get(`SELECT COUNT(*) AS total FROM ${metadata.table}`);
    return Number(row?.['total'] ?? 0);
  }

  /**
   * Fetches the inverse side of an association — the collection Hibernate would
   * populate on first touch.
   *
   * `Editor.books` is `@OneToMany(mappedBy = "editor")`, so it reads the owning
   * foreign key; `Author.books` is `@ManyToMany(mappedBy = "authors")`, so it
   * reads the join table. Which one applies is decided by looking up
   * `mappedBy` on the target entity.
   */
  async loadInverse(
    owner: Entity,
    ownerMetadata: EntityMetadata,
    property: string,
  ): Promise<Entity[]> {
    const inverse = ownerMetadata.inverse.find((candidate) => candidate.property === property);
    if (inverse === undefined || owner.id === null) {
      return [];
    }
    const target = inverse.target();

    const association = target.manyToOne.find(
      (candidate) => candidate.property === inverse.mappedBy,
    );
    if (association !== undefined) {
      return await this.materialiseAll(
        target,
        await this.database.all(
          `SELECT * FROM ${target.table} WHERE ${association.joinColumn} = ?`,
          [owner.id],
        ),
      );
    }

    const collection = target.manyToMany.find(
      (candidate) => candidate.property === inverse.mappedBy,
    );
    if (collection !== undefined) {
      return await this.materialiseAll(
        target,
        await this.database.all(
          `SELECT t.* FROM ${target.table} t ` +
            `JOIN ${collection.joinTable} j ON j.${collection.joinColumn} = t.id ` +
            `WHERE j.${collection.inverseJoinColumn} = ?`,
          [owner.id],
        ),
      );
    }

    return [];
  }

  /**
   * Runs one of the two Panache query shorthands the application uses.
   *
   * Panache accepts either a bare field name — `find("isbn", value)`, which it
   * expands to `WHERE isbn = ?1` — or a fragment of HQL, of which the model
   * only ever uses `id in ?1`. Anything else is rejected rather than guessed
   * at, so an unsupported query fails loudly instead of silently matching
   * everything.
   */
  async query(
    metadata: EntityMetadata,
    query: string,
    params: readonly unknown[],
  ): Promise<Entity[]> {
    const trimmed = query.trim();

    const bareField = /^[A-Za-z_][A-Za-z0-9_]*$/.exec(trimmed);
    if (bareField !== null) {
      const column = columnFor(metadata, trimmed);
      if (column === undefined) {
        throw new TypeError(`Unknown field '${trimmed}' on entity '${metadata.name}'`);
      }
      return await this.materialiseAll(
        metadata,
        await this.database.all(
          `SELECT * FROM ${metadata.table} WHERE ${column.column} = ?`,
          [toSqlValue(params[0])],
        ),
      );
    }

    const inList = /^(\w+)\s+in\s+\?1$/i.exec(trimmed);
    if (inList !== null) {
      const property = (inList as unknown as [string, string])[1];
      const column = property === 'id' ? 'id' : columnFor(metadata, property)?.column;
      if (column === undefined) {
        throw new TypeError(`Unknown field '${property}' on entity '${metadata.name}'`);
      }
      const list = (params[0] ?? []) as unknown[];
      if (list.length === 0) {
        return [];
      }
      return await this.materialiseAll(
        metadata,
        await this.database.all(
          `SELECT * FROM ${metadata.table} WHERE ${column} IN ` +
            `(${list.map(() => '?').join(', ')})`,
          list.map(toSqlValue),
        ),
      );
    }

    throw new TypeError(`Unsupported Panache query: '${query}'`);
  }
}
