/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Book } from '../../../../src/orm/panache/entity/book.js';
import { Editor } from '../../../../src/orm/panache/entity/editor.js';
import { entityManager as em, transactional } from '../../../../src/orm/panache/session.js';

/** `@QuarkusTest` `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)`. */
describe('EditorEntityTest', () => {
  it('createEditor_persistsEditor', async () => {
    await transactional(async () => {
      const editor = new Editor();
      editor.name = 'Test Editor';

      await em.persist(editor);
      await em.flush();

      const persistedEditor = await em.find<Editor>(Editor, editor.id);
      expect(persistedEditor).not.toBeNull();
      expect(persistedEditor?.name).toBe('Test Editor');
    });
  });

  it('createEditor_withBooks_persistsEditorAndBooks', async () => {
    await transactional(async () => {
      const editor = new Editor();
      editor.name = 'Editor with Books';

      const book1 = new Book();
      book1.title = 'Book 1';
      book1.editor = editor;

      const book2 = new Book();
      book2.title = 'Book 2';
      book2.editor = editor;

      editor.books = [book1, book2];

      await em.persist(editor);
      await em.flush();

      const persistedEditor = await em.find<Editor>(Editor, editor.id);
      expect(persistedEditor).not.toBeNull();
      expect(persistedEditor?.name).toBe('Editor with Books');
      expect(persistedEditor?.books?.length).toBe(2);
      expect(persistedEditor?.books?.[0]?.title).toBe('Book 1');
      expect(persistedEditor?.books?.[1]?.title).toBe('Book 2');
    });
  });

  it('updateEditor_updatesExistingEditor', async () => {
    await transactional(async () => {
      const editor = new Editor();
      editor.name = 'Old Editor';
      await em.persist(editor);
      await em.flush();

      editor.name = 'Updated Editor';
      await em.merge(editor);
      await em.flush();

      const updatedEditor = await em.find<Editor>(Editor, editor.id);
      expect(updatedEditor).not.toBeNull();
      expect(updatedEditor?.name).toBe('Updated Editor');
    });
  });

  it('deleteEditor_removesEditor', async () => {
    await transactional(async () => {
      const editor = new Editor();
      editor.name = 'Editor to Delete';
      await em.persist(editor);
      await em.flush();

      await em.remove(editor);
      await em.flush();

      const deletedEditor = await em.find<Editor>(Editor, editor.id);
      expect(deletedEditor).toBeNull();
    });
  });
});
