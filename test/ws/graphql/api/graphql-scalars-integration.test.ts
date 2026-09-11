/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { graphql, graphqlWithVariables, path } from '../../../support/rest.js';

/**
 * A test the original does not have.
 *
 * SmallRye derived the `BigInteger` and `Date` scalars from the Java types and
 * supplied their coercion; the port declares them, so both directions —
 * serialising a value out and reading one in, as a literal and as a variable —
 * are asserted here.
 */
describe('GraphQLScalarsIntegrationTest', () => {
  it('dateScalar_serialisesLocalDateAsIso8601', async () => {
    const response = await graphql('{ book(bookId: 3) { id publication } }');

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.book.publication')).toBe('2022-11-05');
  });

  it('dateScalar_serialisesAnAuthorBirthDate', async () => {
    const response = await graphql('{ author(authorId: 3) { id birthDate } }');

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.author.birthDate')).toBe('1968-11-01');
  });

  it('bigIntegerScalar_readsAnIdentifierFromAVariable', async () => {
    const response = await graphqlWithVariables(
      'query getBook($bookId: BigInteger) { book(bookId: $bookId) { id title } }',
      { bookId: 4 },
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.book.id')).toBe(4);
    expect(path(response, 'data.book.title')).toBe('Enhanced multimedia interface');
  });

  it('dateScalar_readsALocalDateFromAVariable', async () => {
    const response = await graphqlWithVariables(
      'mutation createAuthor($author: AuthorInput) { createAuthor(author: $author) ' +
        '{ id firstName birthDate } }',
      {
        author: {
          firstName: 'Variable',
          lastName: 'Bound',
          sex: 'F',
          birthDate: '1999-12-31',
        },
      },
      'createAuthor',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.createAuthor.firstName')).toBe('Variable');
    expect(path(response, 'data.createAuthor.birthDate')).toBe('1999-12-31');
  });

  it('books_rejectsAnEmptyCursorWithTheParameterConstraint', async () => {
    // `@NotEmpty` fires before the method body, so an empty cursor is a
    // different answer from an undecodable one.
    const response = await graphql('{ books(first: 2, after: "") { edges { cursor } } }');

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toBe(
      'validation failed: books.after must not be empty',
    );
  });

  it('dateScalar_rejectsTextThatIsNotALocalDate', async () => {
    const response = await graphql(
      'mutation { createAuthor(author: { firstName: "Bad", lastName: "Date", sex: "M", ' +
        'birthDate: "31/12/1999" }) { id } }',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toContain(
      "Text '31/12/1999' could not be parsed as a LocalDate",
    );
  });
});
