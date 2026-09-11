/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Author } from '../../../src/orm/panache/entity/author.js';
import { Book } from '../../../src/orm/panache/entity/book.js';
import { Editor } from '../../../src/orm/panache/entity/editor.js';
import { LocalDate } from '../../../src/orm/panache/local-date.js';
import { entityManager as em, transactional } from '../../../src/orm/panache/session.js';

function newBook(title: string): Book {
  const book = new Book();
  book.title = title;
  book.isbn = '5555555555555';
  book.pages = 111;
  book.summary = 'Persistence-context fixture';
  book.publication = LocalDate.of(2025, 2, 1);
  book.genre = 'Fixture';
  return book;
}

/**
 * A test the original does not have.
 *
 * Hibernate supplied the persistence context, the cascades and the dirty
 * checking; the port implements them, so the parts of that contract the
 * application relies on but no ported test reaches are asserted here.
 */
describe('EntityManagerTest', () => {
  it('cascadePersist_acceptsADetachedReferenceCarryingOnlyAnIdentifier', async () => {
    await transactional(async () => {
      const book = newBook('Book with a detached author');
      // What `{ "authors": [{ "id": 16 }] }` deserialises to: an identifier and
      // nothing else. Cascading persist over it must adopt the existing row
      // rather than try to insert a second one.
      const detachedAuthor = new Author();
      detachedAuthor.id = 16;
      book.authors = [detachedAuthor];

      await em.persist(book);
      await em.flush();

      const persisted = await em.find<Book>(Book, book.id);
      expect(persisted?.authors?.[0]?.id).toBe(16);
      expect((await Author.findAuthorById(16))?.firstName).toBe('Stephanie');
    });
  });

  it('remove_deletesADetachedInstanceWithoutLoadingItFirst', async () => {
    const editor = await transactional(async () => {
      const created = new Editor();
      created.name = 'Detached removal';
      await em.persist(created);
      await em.flush();
      return created;
    });

    await transactional(async () => {
      // A reference the context has never seen, as `em.getReference(…)` yields.
      const detached = new Editor();
      detached.id = editor.id;
      await em.remove(detached);
    });

    await transactional(async () => {
      expect(await em.find<Editor>(Editor, editor.id)).toBeNull();
    });
  });

  it('remove_cascadesToTheEditorTheBookOwns', async () => {
    const { bookId, editorId } = await transactional(async () => {
      const book = newBook('Cascading removal');
      const editor = new Editor();
      editor.name = 'Removed with its book';
      book.editor = editor;
      await em.persist(book);
      await em.flush();
      return { bookId: book.id, editorId: editor.id };
    });

    await transactional(async () => {
      // `Book.editor` is @ManyToOne(cascade = CascadeType.ALL), and ALL includes
      // REMOVE, so the editor goes with the book.
      await ((await em.find<Book>(Book, bookId)) as Book).delete();
    });

    await transactional(async () => {
      expect(await em.find<Book>(Book, bookId)).toBeNull();
      expect(await em.find<Editor>(Editor, editorId)).toBeNull();
    });
  });

  it('remove_leavesTheAuthorsAloneBecauseTheyOnlyCascadePersist', async () => {
    const { bookId } = await transactional(async () => {
      const book = newBook('Removal without its authors');
      const author = new Author();
      author.id = 3;
      book.authors = [author];
      await em.persist(book);
      await em.flush();
      return { bookId: book.id };
    });

    await transactional(async () => {
      await ((await em.find<Book>(Book, bookId)) as Book).delete();
    });

    await transactional(async () => {
      expect(await em.find<Book>(Book, bookId)).toBeNull();
      expect((await em.find<Author>(Author, 3))?.firstName).toBe('Bob');
    });
  });

  it('find_returnsTheSameInstanceWithinOneTransaction', async () => {
    await transactional(async () => {
      const first = await em.find<Editor>(Editor, 3);
      const second = await em.find<Editor>(Editor, 3);

      expect(first).toBe(second);
      expect(first).toBe(await Editor.findEditorById(3));
    });
  });

  it('find_readsTheDatabaseAgainInAFreshTransaction', async () => {
    const first = await transactional(async () => await em.find<Editor>(Editor, 3));
    const second = await transactional(async () => await em.find<Editor>(Editor, 3));

    expect(first).not.toBe(second);
    expect(second?.name).toBe(first?.name);
  });

  it('dirtyChecking_writesAChangedFieldWithoutAnExplicitPersist', async () => {
    const book = await transactional(async () => {
      const created = newBook('Dirty checking');
      await em.persist(created);
      await em.flush();
      return created;
    });

    await transactional(async () => {
      const managed = await em.find<Book>(Book, book.id);
      // No persist() and no merge(): the flush at commit has to notice.
      (managed as Book).genre = 'Rewritten';
    });

    await transactional(async () => {
      expect((await em.find<Book>(Book, book.id))?.genre).toBe('Rewritten');
    });
  });

  it('merge_copiesDetachedStateOntoTheManagedInstance', async () => {
    const book = await transactional(async () => {
      const created = newBook('Merge target');
      await em.persist(created);
      await em.flush();
      return created;
    });

    await transactional(async () => {
      const detached = newBook('Merged title');
      detached.id = book.id;

      const managed = await em.merge(detached);
      expect(managed).not.toBe(detached);
      expect(managed.title).toBe('Merged title');
    });

    await transactional(async () => {
      expect((await em.find<Book>(Book, book.id))?.title).toBe('Merged title');
    });
  });

  it('rollback_discardsEverythingTheTransactionWrote', async () => {
    const book = newBook('Rolled back');

    await expect(
      transactional(() => {
        em.persist(book);
        em.flush();
        throw new Error('deliberate failure');
      }),
    ).rejects.toThrow('deliberate failure');

    await transactional(async () => {
      expect(await em.find<Book>(Book, book.id)).toBeNull();
    });
  });

  it('validation_rejectsAValueThePatternConstraintForbids', async () => {
    await transactional(async () => {
      const author = new Author();
      author.firstName = 'Pat';
      author.lastName = 'Tern';
      author.sex = 'X';
      author.birthDate = LocalDate.of(1990, 1, 1);

      await em.persist(author);
      await expect(em.flush()).rejects.toThrow("The admitted values for the sex attribute are: 'M' or 'F'");
    });
  });

  it('validation_rejectsAMissingNonNullableColumn', async () => {
    await transactional(async () => {
      const editor = new Editor();
      const book = new Book();
      book.title = 'No summary';
      book.isbn = '1';
      book.pages = 1;
      book.publication = LocalDate.of(2025, 1, 1);
      book.genre = 'g';
      book.editor = editor;

      await em.persist(book);
      await expect(em.flush()).rejects.toThrow('book.summary: must not be null');
    });
  });
});
