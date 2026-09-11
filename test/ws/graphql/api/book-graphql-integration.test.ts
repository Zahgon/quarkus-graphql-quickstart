/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { graphql, path } from '../../../support/rest.js';

/** `@QuarkusTest` `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)`. */
describe('BookGraphQLIntegrationTest', () => {
  it('allBooks_returnsAllBooks', async () => {
    const response = await graphql('{ allBooks { id title } }');

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.allBooks')).not.toBeNull();
  });

  it('getBook_returnsBookById', async () => {
    const bookId = 5; // Assumes a book with ID 1 exists

    const response = await graphql(
      `query getBook { book(bookId: ${String(bookId)}) { id title } }`,
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.book.id')).toBe(bookId);
    expect(path(response, 'data.book.title')).not.toBeNull();
  });

  it('createBook_createsNewBook', async () => {
    const query =
      'mutation createBook { createBook(book: {title: "Libro da author e editor esistenti", ' +
      'subTitle: "Creato con Quarkus + GraphQL", isbn: "7650986575646", pages: 567, ' +
      'summary: "Summary of the book", publication: "2025-01-28", genre: "fantasy", ' +
      'languages: ["IT"], formats: ["EPUD", "PDF"], keywords: ["key1"], authors: [{id: 5}], ' +
      'editor: {id: 5}}) { id title }}';

    const response = await graphql(query);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.createBook.id')).not.toBeNull();
    expect(path(response, 'data.createBook.title')).toBe('Libro da author e editor esistenti');
  });

  it('addAuthorsToBook_addsAuthorsToBook', async () => {
    const bookId = 5; // Assumes a book with ID 5 exists
    const authorId = 5; // Assumes an author with ID 5 exists

    const response = await graphql(
      `mutation { addAuthorsToBook(bookId: ${String(bookId)}, authorIds: [${String(authorId)}])` +
        ' { id title authors { id firstName lastName } } }',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.addAuthorsToBook.id')).toBe(bookId);
    expect(path(response, 'data.addAuthorsToBook.authors[0].id')).toBe(7);
  });

  it('books_returnsPaginatedBooks', async () => {
    const first = 2;
    const after = 'MA=='; // Base64 encoded cursor, e.g., "0" encoded as "MA=="

    const response = await graphql(
      `{ books(first: ${String(first)}, after: "${after}")` +
        ' { edges { node { id title } cursor } pageInfo { hasNextPage endCursor } } }',
    );

    expect(response.statusCode).toBe(200);
    expect((path(response, 'data.books.edges') as unknown[]).length).toBe(first);
    expect(path(response, 'data.books.pageInfo.hasNextPage')).toBe(true);
    expect(path(response, 'data.books.pageInfo.endCursor')).not.toBeNull();
  });

  it('books_throwsGraphQLExceptionForInvalidCursor', async () => {
    const first = 2;
    const invalidAfter = 'invalid_cursor'; // Invalid cursor format

    const response = await graphql(
      `{ books(first: ${String(first)}, after: "${invalidAfter}")` +
        ' { edges { node { id title } cursor } pageInfo { hasNextPage endCursor } } }',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toContain('Invalid cursor format');
  });

  it('addAuthorsToBook_throwsGraphQLExceptionForNonExistentBook', async () => {
    const nonExistentBookId = 999; // Assumes a book with this ID does not exist
    const authorId = 5; // Assumes an author with ID 5 exists

    const response = await graphql(
      `mutation { addAuthorsToBook(bookId: ${String(nonExistentBookId)}, ` +
        `authorIds: [${String(authorId)}]) { id title authors { id firstName lastName } } }`,
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toContain(
      `Book not found with Id ${String(nonExistentBookId)}`,
    );
  });

  it('createBook_throwsGraphQLExceptionForNonExistentEditor', async () => {
    const query =
      'mutation createBook { createBook(book: {title: "Libro senza editor", ' +
      'subTitle: "Creato con Quarkus + GraphQL", isbn: "7650986575646", pages: 567, ' +
      'summary: "Summary of the book", publication: "2025-01-28", genre: "fantasy", ' +
      'languages: ["IT"], formats: ["EPUD", "PDF"], keywords: ["key1"], authors: [{id: 5}], ' +
      'editor: {id: 999}}) { id title }}';

    const response = await graphql(query);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toContain('Editor not found with Id 999');
  });

  it('createBook_throwsGraphQLExceptionForNonExistentAuthor', async () => {
    const query =
      'mutation createBook { createBook(book: {title: "Libro senza author", ' +
      'subTitle: "Creato con Quarkus + GraphQL", isbn: "7650986575646", pages: 567, ' +
      'summary: "Summary of the book", publication: "2025-01-28", genre: "fantasy", ' +
      'languages: ["IT"], formats: ["EPUD", "PDF"], keywords: ["key1"], authors: [{id: 999}], ' +
      'editor: {id: 5}}) { id title }}';

    const response = await graphql(query);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toContain('Author not found with Id 999');
  });
});
