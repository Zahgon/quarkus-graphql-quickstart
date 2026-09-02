/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * The mapping information the original carries as `jakarta.persistence`
 * annotations.
 *
 * Java reads `@Entity`, `@Column`, `@ManyToMany` and friends off the class at
 * runtime through reflection. TypeScript erases its types, so the same
 * information is declared explicitly next to each entity and read from here by
 * the entity manager, the schema generator and the JSON serialiser.
 */

/** `jakarta.persistence.CascadeType`, narrowed to the members the model uses. */
export type CascadeType = 'PERSIST' | 'MERGE' | 'REMOVE' | 'REFRESH' | 'DETACH';

/** Every member of `CascadeType.ALL`. */
export const CASCADE_ALL: readonly CascadeType[] = [
  'PERSIST',
  'MERGE',
  'REMOVE',
  'REFRESH',
  'DETACH',
];

/** The SQL storage class a mapped property is written as. */
export type ColumnType = 'string' | 'integer' | 'date';

/** `jakarta.validation.constraints.Pattern`. */
export interface PatternConstraint {
  readonly regexp: RegExp;
  readonly message: string;
}

/** A scalar property mapped by `@Column`. */
export interface ColumnMetadata {
  readonly property: string;
  readonly column: string;
  readonly type: ColumnType;
  readonly length?: number;
  readonly nullable: boolean;
  readonly pattern?: PatternConstraint;
}

/** `@ElementCollection` + `@CollectionTable` — a list of scalars in a side table. */
export interface ElementCollectionMetadata {
  readonly property: string;
  readonly table: string;
  readonly joinColumn: string;
  readonly column: string;
  readonly length?: number;
  readonly nullable: boolean;
}

/** `@ManyToOne` + `@JoinColumn` — the owning side of a single-valued association. */
export interface ManyToOneMetadata {
  readonly property: string;
  readonly joinColumn: string;
  readonly target: () => EntityMetadata;
  readonly cascade: readonly CascadeType[];
}

/** `@ManyToMany` + `@JoinTable` — the owning side of a collection association. */
export interface ManyToManyMetadata {
  readonly property: string;
  readonly joinTable: string;
  readonly joinColumn: string;
  readonly inverseJoinColumn: string;
  readonly target: () => EntityMetadata;
  readonly cascade: readonly CascadeType[];
}

/**
 * The inverse (`mappedBy`) side of an association: `@OneToMany(mappedBy = …)`
 * or `@ManyToMany(mappedBy = …)`. It owns no column and writes nothing.
 */
export interface InverseMetadata {
  readonly property: string;
  readonly mappedBy: string;
  readonly target: () => EntityMetadata;
  /** `@JsonBackReference` — excluded from JSON serialisation. */
  readonly jsonBackReference: boolean;
}

export interface EntityMetadata {
  /** `@Entity(name = "…")`. */
  readonly name: string;
  readonly table: string;
  /** Hibernate's per-entity identifier sequence, `<table>_seq`. */
  readonly sequence: string;
  readonly newInstance: () => object;
  readonly columns: readonly ColumnMetadata[];
  readonly elementCollections: readonly ElementCollectionMetadata[];
  readonly manyToOne: readonly ManyToOneMetadata[];
  readonly manyToMany: readonly ManyToManyMetadata[];
  readonly inverse: readonly InverseMetadata[];
}

/** Every entity in the persistence unit, in dependency order. */
const registry: EntityMetadata[] = [];

export function registerEntity(metadata: EntityMetadata): EntityMetadata {
  registry.push(metadata);
  return metadata;
}

export function entityMetadata(): readonly EntityMetadata[] {
  return registry;
}

/** Looks a column up by the property it maps, as HQL does when it resolves a path. */
export function columnFor(
  metadata: EntityMetadata,
  property: string,
): ColumnMetadata | undefined {
  return metadata.columns.find((column) => column.property === property);
}
