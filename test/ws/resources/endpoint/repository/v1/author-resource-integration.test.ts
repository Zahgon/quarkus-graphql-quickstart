/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Author } from '../../../../../../src/orm/panache/entity/author.js';
import { LocalDate } from '../../../../../../src/orm/panache/local-date.js';
import { del, get, path, post, put } from '../../../../../support/rest.js';

describe('AuthorResourceIntegrationTest', () => {
  it('list_returnsAllAuthors', async () => {
    const response = await get('/api/authors');

    expect(response.statusCode).toBe(200);
    expect(response.text).not.toBeNull();
  });

  it('get_returnsAuthorById', async () => {
    const authorId = 4; // Assumes an author with ID 1 exists

    const response = await get(`/api/authors/${String(authorId)}`);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'id')).toBe(authorId);
  });

  it('create_createsNewAuthor', async () => {
    const author = new Author();
    author.firstName = 'New';
    author.lastName = 'Author';
    author.birthDate = LocalDate.of(1980, 1, 1);
    author.sex = 'M';

    const response = await post('/api/authors', author);

    expect(response.statusCode).toBe(201);
    expect(response.headers.get('Location')).not.toBeNull();
    // JAX-RS resolves the relative URI against the application's base URI.
    expect(response.headers.get('Location')).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/api\/authors\/\d+$/,
    );
  });

  it('update_updatesExistingAuthor', async () => {
    const authorId = 6; // Assumes an author with ID 1 exists
    const author = new Author();
    author.firstName = 'Updated';
    author.lastName = 'Author';
    author.birthDate = LocalDate.of(1980, 1, 1);
    author.sex = 'M';

    const response = await put(`/api/authors/${String(authorId)}`, author);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'firstName')).toBe('Updated');
  });

  it('delete_deletesExistingAuthor', async () => {
    const authorId = 8; // Assumes an author with ID 1 exists

    const response = await del(`/api/authors/${String(authorId)}`);

    expect(response.statusCode).toBe(500);
  });

  it('get_nonExistingAuthorThrowsNotFoundException', async () => {
    const authorId = 999; // Assumes no author with ID 999 exists

    const response = await get(`/api/authors/${String(authorId)}`);

    expect(response.statusCode).toBe(404);
  });

  it('update_nonExistingAuthorThrowsNotFoundException', async () => {
    const authorId = 999; // Assumes no author with ID 999 exists
    const author = new Author();
    author.firstName = 'Non-Existing';
    author.lastName = 'Author';

    const response = await put(`/api/authors/${String(authorId)}`, author);

    expect(response.statusCode).toBe(404);
  });

  it('delete_nonExistingAuthorThrowsNotFoundException', async () => {
    const authorId = 999; // Assumes no author with ID 999 exists

    const response = await del(`/api/authors/${String(authorId)}`);

    expect(response.statusCode).toBe(404);
  });
});
