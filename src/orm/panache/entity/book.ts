/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { LocalDate } from '../local-date.js';
import type { EntityMetadata } from '../metadata.js';
import { CASCADE_ALL, registerEntity } from '../metadata.js';
import { PanacheEntity } from '../panache-entity.js';
import type { PanacheQuery } from '../panache-query.js';
import { Author } from './author.js';
import { Editor } from './editor.js';

/** `@Entity(name = "book")`. */
export class Book extends PanacheEntity {
  static readonly metadata: EntityMetadata = registerEntity({
    name: 'book',
    table: 'book',
    sequence: 'book_seq',
    newInstance: (): object => new Book(),
    columns: [
      { property: 'title', column: 'title', type: 'string', length: 60, nullable: false },
      { property: 'subTitle', column: 'sub_title', type: 'string', length: 60, nullable: true },
      { property: 'isbn', column: 'isbn', type: 'string', length: 13, nullable: false },
      { property: 'pages', column: 'pages', type: 'integer', nullable: false },
      { property: 'summary', column: 'summary', type: 'string', nullable: false },
      {
        property: 'publication',
        column: 'publication_date',
        type: 'date',
        nullable: false,
      },
      { property: 'genre', column: 'genre', type: 'string', length: 20, nullable: false },
      {
        property: 'frontCoverImageUrl',
        column: 'front_cover_image_url',
        type: 'string',
        length: 512,
        nullable: true,
      },
      {
        property: 'backCoverImageUrl',
        column: 'back_cover_image_url',
        type: 'string',
        length: 512,
        nullable: true,
      },
    ],
    elementCollections: [
      {
        property: 'languages',
        table: 'book_languages',
        joinColumn: 'book_id',
        column: 'language',
        length: 3,
        nullable: false,
      },
      {
        property: 'formats',
        table: 'book_formats',
        joinColumn: 'book_id',
        column: 'format',
        length: 10,
        nullable: false,
      },
      {
        property: 'keywords',
        table: 'book_keywords',
        joinColumn: 'book_id',
        column: 'keyword',
        nullable: false,
      },
    ],
    manyToMany: [
      {
        property: 'authors',
        joinTable: 'book_authors',
        joinColumn: 'book_id',
        inverseJoinColumn: 'author_id',
        target: () => Author.metadata,
        cascade: ['PERSIST'],
      },
    ],
    manyToOne: [
      {
        property: 'editor',
        joinColumn: 'editor_id',
        target: () => Editor.metadata,
        cascade: CASCADE_ALL,
      },
    ],
    inverse: [],
  });

  title: string | null = null;

  subTitle: string | null = null;

  isbn: string | null = null;

  pages: number | null = null;

  summary: string | null = null;

  publication: LocalDate | null = null;

  genre: string | null = null;

  frontCoverImageUrl: string | null = null;

  backCoverImageUrl: string | null = null;

  /** `@ElementCollection` `@CollectionTable(name = "book_languages")`. */
  languages: string[] | null = null;

  /** `@ElementCollection` `@CollectionTable(name = "book_formats")`. */
  formats: string[] | null = null;

  /** `@ElementCollection` `@CollectionTable(name = "book_keywords")`. */
  keywords: string[] | null = null;

  /** `@ManyToMany(cascade = CascadeType.PERSIST)` `@JoinTable(name = "book_authors")`. */
  authors: Author[] | null = null;

  /** `@ManyToOne(cascade = CascadeType.ALL)` `@JoinColumn(name = "editor_id")`. */
  editor: Editor | null = null;

  /**
   * Finds all books.
   *
   * @returns a list of all books.
   */
  static findAllBooks(): PanacheQuery<Book> {
    return Book.findAll();
  }

  /**
   * Finds all books.
   *
   * @returns a list of all books.
   */
  static async findAllBooksList(): Promise<Book[]> {
    return await Book.listAll();
  }

  /**
   * Finds a book by its ID.
   *
   * @param id the ID of the book to find.
   * @returns the book with the specified ID, or null if no such book exists.
   */
  static async findBookById(id: number | null): Promise<Book | null> {
    return await Book.findById(id);
  }

  /**
   * Finds a book by a query.
   *
   * @param query the query to execute.
   * @param params the query parameters.
   * @returns the book matching the specified query, or null if no such book exists.
   */
  static async findBookByQuery(query: string, ...params: unknown[]): Promise<Book | null> {
    return await Book.find(query, ...params).firstResult();
  }
}
