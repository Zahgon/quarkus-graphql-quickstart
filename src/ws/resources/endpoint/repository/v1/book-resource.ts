/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { FastifyInstance } from 'fastify';

import { NotFoundException, Response, Status } from '../../../../../deps/jaxrs.js';
import { Author } from '../../../../../orm/panache/entity/author.js';
import { Book } from '../../../../../orm/panache/entity/book.js';
import { fromJson } from '../../../../../orm/panache/json.js';
import { transactional } from '../../../../../orm/panache/session.js';
import { sendResponse } from '../../../binding.js';

/** `@Path("/books")`, producing and consuming `application/json`. */
export class BookResource {
  async list(): Promise<Book[]> {
    return await Book.findAllBooksList();
  }

  async get(id: number): Promise<Book> {
    const book = await Book.findBookById(id);
    if (book === null) {
      throw new NotFoundException();
    }
    return book;
  }

  async create(book: Book): Promise<Response> {
    return await transactional(async () => {
      // The book is persisted automatically by Panache
      // because it is a Panache entity.
      // Extend this method to handle the detached entity as needed.
      await book.persist();
      return Response.created(`/books/${String(book.id)}`).build();
    });
  }

  async update(id: number, book: Book): Promise<Book> {
    return await transactional(async () => {
      // The book is persisted automatically by Panache
      // because it is a Panache entity.
      // Extend this method to handle the detached entity as needed.

      const entity = await Book.findBookById(id);
      if (entity === null) {
        throw new NotFoundException();
      }

      // Update the entity with the new values
      // Extend this method to handle the updated entity as needed.
      entity.title = book.title;
      entity.editor = book.editor;
      entity.authors = book.authors;
      entity.languages = book.languages;
      entity.formats = book.formats;
      entity.keywords = book.keywords;
      return entity;
    });
  }

  async delete(id: number): Promise<void> {
    await transactional(async () => {
      const entity = await Book.findBookById(id);
      if (entity !== null) {
        await entity.delete();
      }
    });
  }

  async addAuthors(id: number, authorIds: number[]): Promise<Book> {
    return await transactional(async () => {
      const book = await Book.findBookById(id);
      if (book === null) {
        throw new NotFoundException('Book not found');
      }

      const authors = await Author.listByAuthorList('id in ?1', authorIds);
      // A collection on a loaded entity is always initialised, never null.
      (book.authors as Author[]).push(...authors);
      return book;
    });
  }
}

export function registerBookResource(app: FastifyInstance, resource: BookResource): void {
  app.get('/books', async (_request, reply) => reply.send(await resource.list()));

  app.get<{ Params: { id: string } }>('/books/:id', async (request, reply) =>
    reply.send(await resource.get(Number(request.params.id))),
  );

  app.post('/books', async (request, reply) => {
    const response = await resource.create(fromJson(Book, request.body));
    return sendResponse(reply, response);
  });

  app.put<{ Params: { id: string } }>('/books/:id', async (request, reply) =>
    reply.send(await resource.update(Number(request.params.id), fromJson(Book, request.body))),
  );

  app.delete<{ Params: { id: string } }>('/books/:id', async (request, reply) => {
    await resource.delete(Number(request.params.id));
    return reply.code(Status.NO_CONTENT).send();
  });

  app.put<{ Params: { id: string }; Body: number[] }>(
    '/books/:id/authors',
    async (request, reply) =>
      reply.send(await resource.addAuthors(Number(request.params.id), request.body)),
  );
}
