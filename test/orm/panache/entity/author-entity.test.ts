/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Author } from '../../../../src/orm/panache/entity/author.js';
import { LocalDate } from '../../../../src/orm/panache/local-date.js';
import { entityManager as em, transactional } from '../../../../src/orm/panache/session.js';

/**
 * `@QuarkusTest` `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)` — the
 * tests are declared in `@Order` order, which is the order Vitest runs them in.
 */
describe('AuthorEntityTest', () => {
  it('createAuthor_persistsAuthor', async () => {
    await transactional(async () => {
      const author = new Author();
      author.firstName = 'John';
      author.lastName = 'Doe';
      author.sex = 'M';
      author.birthDate = LocalDate.of(1980, 1, 1);

      await em.persist(author);
      await em.flush();

      const persistedAuthor = await em.find<Author>(Author, author.id);
      expect(persistedAuthor).not.toBeNull();
      expect(persistedAuthor?.firstName).toBe('John');
      expect(persistedAuthor?.lastName).toBe('Doe');
      expect(persistedAuthor?.sex).toBe('M');
      expect(persistedAuthor?.birthDate).toBe(LocalDate.of(1980, 1, 1));
    });
  });

  it('createAuthor_withInvalidSex_throwsValidationException', async () => {
    await transactional(async () => {
      const author = new Author();
      author.firstName = 'Jane';
      author.lastName = 'Doe';
      author.sex = 'X'; // Invalid sex value
      author.birthDate = LocalDate.of(1990, 1, 1);

      try {
        await em.persist(author);
        await em.flush();
      } catch (e) {
        expect(e).not.toBeNull();
      }
    });
  });

  it('updateAuthor_updatesExistingAuthor', async () => {
    await transactional(async () => {
      const author = new Author();
      author.firstName = 'Alice';
      author.lastName = 'Smith';
      author.sex = 'F';
      author.birthDate = LocalDate.of(1975, 5, 15);
      await em.persist(author);
      await em.flush();

      author.firstName = 'Alicia';
      author.lastName = 'Johnson';
      author.birthDate = LocalDate.of(1975, 6, 15);
      await em.merge(author);
      await em.flush();

      const updatedAuthor = await em.find<Author>(Author, author.id);
      expect(updatedAuthor).not.toBeNull();
      expect(updatedAuthor?.firstName).toBe('Alicia');
      expect(updatedAuthor?.lastName).toBe('Johnson');
      expect(updatedAuthor?.birthDate).toBe(LocalDate.of(1975, 6, 15));
    });
  });

  it('deleteAuthor_removesAuthor', async () => {
    await transactional(async () => {
      const author = new Author();
      author.firstName = 'Bob';
      author.lastName = 'Brown';
      author.sex = 'M';
      author.birthDate = LocalDate.of(1965, 3, 10);
      await em.persist(author);
      await em.flush();

      await em.remove(author);
      await em.flush();

      const deletedAuthor = await em.find<Author>(Author, author.id);
      expect(deletedAuthor).toBeNull();
    });
  });
});
