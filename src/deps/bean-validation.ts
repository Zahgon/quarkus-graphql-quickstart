/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * The slice of Jakarta Bean Validation the application declares.
 *
 * Quarkus validates a CDI bean's method parameters whenever they carry
 * constraints, and SmallRye GraphQL turns the resulting violation into
 * `errors[0].message`. `BookGraphQL.books` relies on it: an empty cursor is
 * rejected by `@NotEmpty` before the method body ever runs, which is a
 * different answer from the one an undecodable cursor gets.
 */
export class ConstraintViolationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintViolationException';
  }
}

/**
 * `@NotEmpty` + `@NotNull` on a method parameter.
 *
 * @param location the violation's path, `<method>.<parameter>`, as Hibernate
 *   Validator renders it
 */
export function notEmpty(location: string, value: string | Uint8Array | null | undefined): void {
  if (value === null || value === undefined) {
    throw new ConstraintViolationException(`validation failed: ${location} must not be null`);
  }
  if (value.length === 0) {
    throw new ConstraintViolationException(`validation failed: ${location} must not be empty`);
  }
}
