/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { FastifyInstance } from 'fastify';

import { NotFoundException, Response, Status } from '../../../../../deps/jaxrs.js';
import { Author } from '../../../../../orm/panache/entity/author.js';
import { fromJson } from '../../../../../orm/panache/json.js';
import { transactional } from '../../../../../orm/panache/session.js';
import { sendResponse } from '../../../binding.js';

/** `@Path("/authors")`, producing and consuming `application/json`. */
export class AuthorResource {
  async list(): Promise<Author[]> {
    return await Author.findAllAuthors();
  }

  async get(id: number): Promise<Author> {
    const author = await Author.findAuthorById(id);
    if (author === null) {
      throw new NotFoundException();
    }
    return author;
  }

  async create(author: Author): Promise<Response> {
    return await transactional(async () => {
      await author.persist();
      return Response.created(`/authors/${String(author.id)}`).build();
    });
  }

  async update(id: number, author: Author): Promise<Author> {
    return await transactional(async () => {
      const existingAuthor = await Author.findAuthorById(id);
      if (existingAuthor === null) {
        throw new NotFoundException();
      }
      existingAuthor.firstName = author.firstName;
      existingAuthor.lastName = author.lastName;
      existingAuthor.sex = author.sex;
      existingAuthor.birthDate = author.birthDate;

      //... update other fields
      await existingAuthor.persist();
      return existingAuthor;
    });
  }

  async delete(id: number): Promise<void> {
    await transactional(async () => {
      const author = await Author.findAuthorById(id);
      if (author === null) {
        throw new NotFoundException();
      }
      await author.delete();
    });
  }
}

export function registerAuthorResource(app: FastifyInstance, resource: AuthorResource): void {
  app.get('/authors', async (_request, reply) => reply.send(await resource.list()));

  app.get<{ Params: { id: string } }>('/authors/:id', async (request, reply) =>
    reply.send(await resource.get(Number(request.params.id))),
  );

  app.post('/authors', async (request, reply) => {
    const response = await resource.create(fromJson(Author, request.body));
    return sendResponse(reply, response);
  });

  app.put<{ Params: { id: string } }>('/authors/:id', async (request, reply) =>
    reply.send(await resource.update(Number(request.params.id), fromJson(Author, request.body))),
  );

  app.delete<{ Params: { id: string } }>('/authors/:id', async (request, reply) => {
    await resource.delete(Number(request.params.id));
    return reply.code(Status.NO_CONTENT).send();
  });
}
