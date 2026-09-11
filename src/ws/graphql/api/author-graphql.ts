/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { GraphQLException } from '../../../deps/graphql-exception.js';
import { Author } from '../../../orm/panache/entity/author.js';
import { transactional } from '../../../orm/panache/session.js';

/** `@GraphQLApi` `@ApplicationScoped`. */
export class AuthorGraphQL {
  /** `@Query` `@Description("Get all authors")`. */
  async allAuthors(): Promise<Author[]> {
    return await Author.findAllAuthors();
  }

  /** `@Query` `@Description("Get an author by id")`. */
  async getAuthor(id: number | null): Promise<Author | null> {
    return await Author.findAuthorById(id);
  }

  /** `@Mutation` `@Description("Create a new author")` `@Transactional`. */
  async createAuthor(author: Author): Promise<Author> {
    return await transactional(async () => {
      // The author is persisted automatically by Panache
      // because it is a Panache entity.
      // Extend this method to handle the detached entity as needed.
      await author.persist();
      return author;
    });
  }

  /** `@Mutation` `@Description("Delete an author by id")` `@Transactional`. */
  async updateAuthor(id: number, authorData: Author): Promise<Author> {
    return await transactional(async () => {
      const author = await this.getAuthor(id);
      if (author === null) {
        throw new GraphQLException(`Author not found with Id ${String(id)}`);
      }
      author.firstName = authorData.firstName;
      author.lastName = authorData.lastName;
      author.sex = authorData.sex;
      author.birthDate = authorData.birthDate;
      await author.persist();
      return author;
    });
  }
}
