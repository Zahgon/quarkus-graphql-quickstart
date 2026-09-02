/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Author } from '../../../src/orm/panache/entity/author.js';
import { Book } from '../../../src/orm/panache/entity/book.js';
import { Editor } from '../../../src/orm/panache/entity/editor.js';
import { runInSession } from '../../../src/orm/panache/session.js';

/**
 * A test the original does not have: Panache supplied these finders, and the
 * entities' public API is preserved, so each one has to keep working. It also
 * covers `findAllEditors`, which the application itself never calls but which
 * is part of the surface the port had to carry over.
 */
describe('PanacheEntityTest', () => {
  it('findAllEditors_returnsAQueryOverEveryEditor', async () => {
    await runInSession(async () => {
      const query = Editor.findAllEditors();

      expect(await query.count()).toBe((await Editor.listAllEditors()).length);
      expect((await query.list())[0]?.id).toBe(3);
    });
  });

  it('findAllBooks_rangeIsInclusiveOfBothBounds', async () => {
    await runInSession(async () => {
      const range = await Book.findAllBooks().range(0, 2).list();

      expect(range.length).toBe(3);
      expect(range.map((book) => book.id)).toEqual([3, 4, 5]);
    });
  });

  it('findBookByQuery_resolvesABareFieldNameToAnEquality', async () => {
    await runInSession(async () => {
      const book = await Book.findBookByQuery('isbn', '9780785316371');

      expect(book?.id).toBe(3);
      expect(await Book.findBookByQuery('isbn', 'no-such-isbn')).toBeNull();
    });
  });

  it('listByAuthorList_resolvesAnInClause', async () => {
    await runInSession(async () => {
      expect(
        (await Author.listByAuthorList('id in ?1', [3, 4])).map((author) => author.id),
      ).toEqual([3, 4]);
      expect(await Author.listByAuthorList('id in ?1', [])).toEqual([]);
    });
  });

  it('query_rejectsAnUnsupportedPanacheExpression', async () => {
    await runInSession(async () => {
      await expect(Book.list('title like ?1', '%a%')).rejects.toThrow(TypeError);
      await expect(Book.list('noSuchField', 'x')).rejects.toThrow(TypeError);
    });
  });

  it('toJSON_omitsTheJsonBackReferenceCollections', async () => {
    await runInSession(async () => {
      const author = await Author.findAuthorById(3);

      expect(Object.keys(author?.toJSON() ?? {})).toEqual([
        'id',
        'firstName',
        'lastName',
        'sex',
        'birthDate',
      ]);
    });
  });
});
