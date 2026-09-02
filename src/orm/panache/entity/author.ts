/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { LocalDate } from '../local-date.js';
import type { EntityMetadata } from '../metadata.js';
import { registerEntity } from '../metadata.js';
import { PanacheEntity } from '../panache-entity.js';
import { Book } from './book.js';

/** `@Entity(name = "author")`. */
export class Author extends PanacheEntity {
  static readonly metadata: EntityMetadata = registerEntity({
    name: 'author',
    table: 'author',
    sequence: 'author_seq',
    newInstance: (): object => new Author(),
    columns: [
      { property: 'firstName', column: 'first_name', type: 'string', length: 60, nullable: false },
      { property: 'lastName', column: 'last_name', type: 'string', length: 60, nullable: false },
      {
        property: 'sex',
        column: 'sex',
        type: 'string',
        length: 1,
        nullable: false,
        pattern: {
          regexp: /^[MF]$/,
          message: "The admitted values for the sex attribute are: 'M' or 'F'",
        },
      },
      { property: 'birthDate', column: 'birth_date', type: 'date', nullable: false },
    ],
    elementCollections: [],
    manyToOne: [],
    manyToMany: [],
    inverse: [
      { property: 'books', mappedBy: 'authors', target: () => Book.metadata, jsonBackReference: true },
    ],
  });

  firstName: string | null = null;

  lastName: string | null = null;

  sex: string | null = null;

  birthDate: LocalDate | null = null;

  /** `@ManyToMany(mappedBy = "authors")` `@JsonBackReference`. */
  books: Book[] | null = null;

  /**
   * Finds all authors.
   *
   * @returns a list of all authors.
   */
  static async findAllAuthors(): Promise<Author[]> {
    return await Author.listAll();
  }

  /**
   * Finds an author by their ID.
   *
   * @param id the ID of the author to find.
   * @returns the author with the specified ID, or null if no such author exists.
   */
  static async findAuthorById(id: number | null): Promise<Author | null> {
    return await Author.findById(id);
  }

  /**
   * Finds authors by a list of IDs.
   *
   * @param query the query to execute.
   * @param authorIds the list of author IDs to find.
   * @returns a list of authors matching the specified IDs.
   */
  static async listByAuthorList(query: string, authorIds: number[]): Promise<Author[]> {
    return await Author.list(query, authorIds);
  }
}
