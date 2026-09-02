/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { EntityMetadata } from './metadata.js';
import type { PanacheEntity, EntityClass } from './panache-entity.js';

/**
 * Jackson's databind step for the mapped entities.
 *
 * The REST resources and the GraphQL mutations both receive a JSON object and
 * hand the framework an entity instance. Jackson does that by reflecting over
 * the public fields; here the same walk is driven by the mapping metadata.
 * Absent properties stay `null`, which is what makes
 * `{ "authors": [{ "id": 5 }] }` arrive as an `Author` carrying nothing but an
 * identifier — exactly the shape `BookGraphQL.handleAuthors` resolves.
 */
export function fromJson<T extends PanacheEntity>(
  entityClass: EntityClass<T>,
  source: unknown,
): T {
  return bind(entityClass.metadata, source) as T;
}

function bind(metadata: EntityMetadata, source: unknown): object {
  const entity = metadata.newInstance() as Record<string, unknown> & { id: number | null };
  if (source === null || typeof source !== 'object') {
    return entity;
  }
  const json = source as Record<string, unknown>;

  if (json['id'] !== undefined && json['id'] !== null) {
    entity.id = Number(json['id']);
  }

  for (const column of metadata.columns) {
    const value = json[column.property];
    if (value === undefined) {
      continue;
    }
    entity[column.property] =
      value === null ? null : column.type === 'integer' ? Number(value) : String(value);
  }

  for (const collection of metadata.elementCollections) {
    const value = json[collection.property];
    if (value === undefined) {
      continue;
    }
    entity[collection.property] = Array.isArray(value) ? value.map((item) => String(item)) : null;
  }

  for (const association of metadata.manyToMany) {
    const value = json[association.property];
    if (value === undefined) {
      continue;
    }
    entity[association.property] = Array.isArray(value)
      ? value.map((item) => bind(association.target(), item))
      : null;
  }

  for (const association of metadata.manyToOne) {
    const value = json[association.property];
    if (value === undefined) {
      continue;
    }
    entity[association.property] = value === null ? null : bind(association.target(), value);
  }

  return entity;
}
