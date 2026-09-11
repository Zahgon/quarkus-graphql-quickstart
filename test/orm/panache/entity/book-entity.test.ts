/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Author } from '../../../../src/orm/panache/entity/author.js';
import { Book } from '../../../../src/orm/panache/entity/book.js';
import { Editor } from '../../../../src/orm/panache/entity/editor.js';
import { LocalDate } from '../../../../src/orm/panache/local-date.js';
import { entityManager as em, transactional } from '../../../../src/orm/panache/session.js';

describe('BookEntityTest', () => {
  it('createBook_persistsBook', async () => {
    await transactional(async () => {
      const book = new Book();
      book.title = 'Test Book';
      book.isbn = '1234567890123';
      book.pages = 300;
      book.summary = 'Test summary';
      book.publication = LocalDate.now();
      book.genre = 'Test Genre';
      book.languages = ['ENG'];
      book.formats = ['PDF'];
      book.keywords = ['test', 'book'];

      const editor = new Editor();
      editor.name = 'Test Editor';
      book.editor = editor;

      const author = new Author();
      author.firstName = 'Test Author';
      author.lastName = 'Doe';
      author.sex = 'M';
      author.birthDate = LocalDate.of(1980, 1, 1);
      book.authors = [author];

      await em.persist(book);
      await em.flush();

      const persistedBook = await em.find<Book>(Book, book.id);
      expect(persistedBook).not.toBeNull();
      expect(persistedBook?.title).toBe('Test Book');
      expect(persistedBook?.isbn).toBe('1234567890123');
      expect(persistedBook?.pages).toBe(300);
      expect(persistedBook?.summary).toBe('Test summary');
      expect(persistedBook?.publication).toBe(LocalDate.now());
      expect(persistedBook?.genre).toBe('Test Genre');
      expect(persistedBook?.languages?.length).toBe(1);
      expect(persistedBook?.languages?.[0]).toBe('ENG');
      expect(persistedBook?.formats?.length).toBe(1);
      expect(persistedBook?.formats?.[0]).toBe('PDF');
      expect(persistedBook?.keywords?.length).toBe(2);
      expect(persistedBook?.keywords?.[0]).toBe('test');
      expect(persistedBook?.keywords?.[1]).toBe('book');
      expect(persistedBook?.editor).not.toBeNull();
      expect(persistedBook?.editor?.name).toBe('Test Editor');
      expect(persistedBook?.authors?.length).toBe(1);
      expect(persistedBook?.authors?.[0]?.firstName).toBe('Test Author');
    });
  });
});
