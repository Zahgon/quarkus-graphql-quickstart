/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * `org.eclipse.microprofile.graphql.GraphQLException`.
 *
 * A checked exception in the MicroProfile GraphQL API. SmallRye treats it as an
 * *application* error and copies its message straight into
 * `errors[0].message`, which several of the tests assert on.
 */
export class GraphQLException extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'GraphQLException';
  }
}
