/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { graphql, path } from '../../../support/rest.js';

/**
 * A test the original does not have.
 *
 * `Author.books` and `Editor.books` are the inverse sides of their
 * associations; Hibernate resolved them lazily when the field was first
 * touched, and the port resolves them the same way when GraphQL selects them.
 * The two sides read differently — one follows a foreign key, the other a join
 * table — so both are exercised here.
 */
describe('InverseAssociationIntegrationTest', () => {
  it('editorBooks_followsTheOwningForeignKey', async () => {
    const response = await graphql('{ editor(editorId: 3) { id name books { id title } } }');

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.editor.books[0].id')).toBe(3);
    expect(path(response, 'data.editor.books[0].title')).toBe('Networked neural strategy');
  });

  it('authorBooks_followsTheJoinTable', async () => {
    const response = await graphql('{ author(authorId: 3) { id firstName books { id title } } }');

    expect(response.statusCode).toBe(200);
    expect(
      (path(response, 'data.author.books') as { id: number }[]).map((book) => book.id),
    ).toEqual([3, 9]);
  });

  it('inverseCollection_isEmptyWhenNothingReferencesTheOwner', async () => {
    const response = await graphql('{ editor(editorId: 4) { id books { id } } }');

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.editor.books')).toEqual([{ id: 4 }]);
  });
});
