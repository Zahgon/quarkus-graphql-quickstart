/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Book } from '../../../../../../src/orm/panache/entity/book.js';
import { Editor } from '../../../../../../src/orm/panache/entity/editor.js';
import { LocalDate } from '../../../../../../src/orm/panache/local-date.js';
import { del, get, path, post, put } from '../../../../../support/rest.js';

describe('BookResourceIntegrationTest', () => {
  it('getAll_returnsAllBooks', async () => {
    const response = await get('/api/books');

    expect(response.statusCode).toBe(200);
    expect(response.text).not.toBeNull();
  });

  it('create_createsNewBook', async () => {
    const book = new Book();
    book.title = 'New Book';
    book.formats = ['EPUB'];
    book.pages = 5406;
    book.isbn = '123345435';
    book.genre = 'Fiction';
    book.summary = 'This is a book';
    book.publication = LocalDate.now();
    book.editor = new Editor();
    book.editor.name = 'Editor';

    const response = await post('/api/books', book);

    expect(response.statusCode).toBe(201);
    expect(response.headers.get('Location')).not.toBeNull();
  });

  it('get_returnsBookById', async () => {
    const bookId = 5; // Assumes a book with ID 1 exists

    const response = await get(`/api/books/${String(bookId)}`);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'id')).toBe(bookId);
  });

  it('update_updatesExistingBook', async () => {
    const bookId = 5; // Assumes a book with ID 1 exists
    const book = new Book();
    book.title = 'Updated Book';
    book.formats = ['PDF'];
    book.pages = 123;
    book.isbn = '987654321';
    book.genre = 'Non-Fiction';
    book.summary = 'This is an updated book';
    book.publication = LocalDate.now();
    book.editor = new Editor();
    book.editor.name = 'Updated Editor';
    book.languages = ['EN'];
    book.keywords = ['Updated', 'Book'];

    const response = await put(`/api/books/${String(bookId)}`, book);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'title')).toBe('Updated Book');
  });

  it('delete_deletesExistingBook', async () => {
    const bookId = 1; // Assumes a book with ID 1 exists

    const response = await del(`/api/books/${String(bookId)}`);

    expect(response.statusCode).toBe(204);
  });

  it('get_throwsNotFoundExceptionForNonExistentBook', async () => {
    const nonExistentBookId = 999; // Assumes a book with this ID does not exist

    const response = await get(`/api/books/${String(nonExistentBookId)}`);

    expect(response.statusCode).toBe(404);
  });

  it('update_throwsNotFoundExceptionForNonExistentBook', async () => {
    const nonExistentBookId = 999; // Assumes a book with this ID does not exist
    const book = new Book();
    book.title = 'Non-Existent Book';
    book.formats = ['PDF'];
    book.pages = 123;
    book.isbn = '987654321';
    book.genre = 'Non-Fiction';
    book.summary = 'This is a non-existent book';
    book.publication = LocalDate.now();
    book.editor = new Editor();
    book.editor.name = 'Non-Existent Editor';
    book.languages = ['EN'];
    book.keywords = ['Non-Existent', 'Book'];

    const response = await put(`/api/books/${String(nonExistentBookId)}`, book);

    expect(response.statusCode).toBe(404);
  });

  it('addAuthors_throwsNotFoundExceptionForNonExistentBook', async () => {
    const nonExistentBookId = 999; // Assumes a book with this ID does not exist
    const authorIds = [1, 2]; // Assumes authors with these IDs exist

    const response = await put(
      `/api/books/${String(nonExistentBookId)}/authors`,
      authorIds,
    );

    expect(response.statusCode).toBe(404);
  });

  it('delete_deletesBookWithId17', async () => {
    const bookId = 17; // Assumes a book with ID 17 exists

    const response = await del(`/api/books/${String(bookId)}`);

    expect(response.statusCode).toBe(204);
  });
});
