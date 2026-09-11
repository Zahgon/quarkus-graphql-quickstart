/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { graphql, path } from '../../../support/rest.js';

/** `@QuarkusTest` `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)`. */
describe('AuthorGraphQLIntegrationTest', () => {
  it('allAuthors_returnsAllAuthors', async () => {
    const response = await graphql('{ allAuthors { firstName lastName } }');

    expect(response.statusCode).toBe(200);
  });

  it('getAuthor_returnsAuthorById', async () => {
    const authorId = 5; // Assumes an author with ID 5 exists

    const response = await graphql(
      `query getAuthor { author(authorId: ${String(authorId)}) { id firstName lastName } }`,
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.author.id')).toBe(authorId);
  });

  it('createAuthor_createsNewAuthor', async () => {
    const query =
      'mutation { createAuthor(author: { firstName: "John", lastName: "Doe", sex: "M", birthDate: "1980-01-01" }) { id firstName lastName } }';

    const response = await graphql(query);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.createAuthor.id')).not.toBeNull();
    expect(path(response, 'data.createAuthor.firstName')).toBe('John');
    expect(path(response, 'data.createAuthor.lastName')).toBe('Doe');
  });

  it('updateAuthor_updatesExistingAuthor', async () => {
    const authorId = 5; // Assumes an author with ID 5 exists
    const query =
      `mutation { updateAuthor(authorId: ${String(authorId)}` +
      ', authorData: { firstName: "Jane", lastName: "Doe", sex: "F", birthDate: "1985-01-01" }) { id firstName lastName } }';

    const response = await graphql(query);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.updateAuthor.id')).toBe(authorId);
    expect(path(response, 'data.updateAuthor.firstName')).toBe('Jane');
    expect(path(response, 'data.updateAuthor.lastName')).toBe('Doe');
  });

  it('updateAuthor_throwsGraphQLExceptionForNonExistentAuthor', async () => {
    const nonExistentAuthorId = 999; // Assumes an author with this ID does not exist
    const query =
      `mutation { updateAuthor(authorId: ${String(nonExistentAuthorId)}` +
      ', authorData: { firstName: "Jane", lastName: "Doe", sex: "F", birthDate: "1985-01-01" }) { id firstName lastName } }';

    const response = await graphql(query);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toContain(
      `Author not found with Id ${String(nonExistentAuthorId)}`,
    );
  });
});
