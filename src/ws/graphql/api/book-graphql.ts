/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { notEmpty } from '../../../deps/bean-validation.js';
import { BroadcastProcessor } from '../../../deps/broadcast-processor.js';
import { GraphQLException } from '../../../deps/graphql-exception.js';
import {
  decodeBase64,
  encodeBase64,
  IllegalArgumentException,
  parseInt10,
} from '../../../deps/java-lang.js';
import { Author } from '../../../orm/panache/entity/author.js';
import { Book } from '../../../orm/panache/entity/book.js';
import { Editor } from '../../../orm/panache/entity/editor.js';
import type { PanacheQuery } from '../../../orm/panache/panache-query.js';
import type { InjectedEntityManager } from '../../../orm/panache/session.js';
import { transactional } from '../../../orm/panache/session.js';
import { BookConnection } from '../../../pagination/type/book-connection.js';
import { BookEdge } from '../../../pagination/type/book-edge.js';
import { PageInfo } from '../../../pagination/type/page-info.js';

/** `@GraphQLApi` `@ApplicationScoped`. */
export class BookGraphQL {
  // Broadcast processor to notify subscribers
  private readonly processor = BroadcastProcessor.create<Book>();

  constructor(private readonly entityManager: InjectedEntityManager) {}

  /**
   * Retrieves a paginated list of books.
   *
   * @param first the number of books to retrieve
   * @param after the cursor after which to start retrieving books
   * @returns a BookConnection containing the list of books and pagination information
   * @throws GraphQLException if an error occurs during retrieval
   */
  async books(first: number, after: string): Promise<BookConnection> {
    notEmpty('books.after', after);

    let startIndex: number;

    // Decode the cursor to get the start index
    try {
      const decoded = decodeBase64(after).toString('utf8');
      startIndex = parseInt10(decoded) + 1;
    } catch (error) {
      if (error instanceof IllegalArgumentException) {
        throw new GraphQLException('Invalid cursor format', error);
      }
      throw error;
    }

    // Query Panache to get the books
    const query: PanacheQuery<Book> = Book.findAllBooks();
    const books = await query.range(startIndex, startIndex + first - 1).list();

    // Create the edges response with the cursor
    const edges = books.map((book) => {
      const cursor = encodeBase64(String(book.id));
      return BookEdge.create(book, cursor);
    });

    // Check if there are more pages
    const endCursor = edges.length === 0 ? null : (edges[edges.length - 1] as BookEdge).cursor;
    const hasNextPage = startIndex + first < (await query.count());

    return BookConnection.create(edges, PageInfo.create(hasNextPage, endCursor));
  }

  /**
   * Retrieves all books.
   *
   * @returns a list of all books
   */
  async allBooks(): Promise<Book[]> {
    return await Book.findAllBooksList();
  }

  /**
   * Retrieves a book by its ID.
   *
   * @param id the ID of the book to retrieve
   * @returns the book with the specified ID
   */
  async getBook(id: number | null): Promise<Book | null> {
    return await Book.findBookById(id);
  }

  /**
   * Creates a new book and notifies subscribers.
   *
   * @param book the book to create
   * @returns the created book
   * @throws GraphQLException if an error occurs during creation
   */
  async createBook(book: Book): Promise<Book> {
    return await transactional(async () => {
      // Handle the editor and authors
      await this.handleEditor(book);
      await this.handleAuthors(book);

      // Persist the book and flush to get the ID
      await this.entityManager.persist(book);
      await this.entityManager.flush();

      // Notify subscribers
      this.processor.onNext(book);

      return book;
    });
  }

  /**
   * Adds authors to a book by its ID.
   *
   * @param bookId the ID of the book
   * @param authorIds the IDs of the authors to add
   * @returns the updated book
   * @throws GraphQLException if the book or authors are not found
   */
  async addAuthorsToBook(bookId: number, authorIds: number[]): Promise<Book> {
    return await transactional(async () => {
      const book = await this.getBook(bookId);
      if (book === null) {
        throw new GraphQLException(`Book not found with Id ${String(bookId)}`);
      }
      const authors = await Author.listByAuthorList('id in ?1', authorIds);
      // A collection on a loaded entity is always initialised, never null.
      (book.authors as Author[]).push(...authors);
      return book;
    });
  }

  /**
   * Subscription method to notify subscribers when a new book is created.
   *
   * @returns a stream of Book objects representing the created books
   */
  bookCreated(): AsyncIterable<Book> {
    return this.processor;
  }

  /**
   * Handles the editor of a book.
   *
   * @param book the book whose editor is to be handled
   * @throws GraphQLException if the editor is not found
   */
  private async handleEditor(book: Book): Promise<void> {
    if (book.editor !== null && book.editor.id !== null) {
      const foundEditor = await Editor.findEditorById(book.editor.id);
      if (foundEditor === null) {
        throw new GraphQLException(`Editor not found with Id ${String(book.editor.id)}`);
      }
      book.editor = foundEditor;
    }
  }

  /**
   * Handles the authors of a book.
   *
   * @param book the book whose authors are to be handled
   * @throws GraphQLException if any author is not found
   */
  private async handleAuthors(book: Book): Promise<void> {
    if (book.authors !== null) {
      const updatedAuthors: Author[] = [];
      for (const author of book.authors) {
        if (author.id !== null) {
          const foundAuthor = await Author.findAuthorById(author.id);
          if (foundAuthor === null) {
            throw new GraphQLException(`Author not found with Id ${String(author.id)}`);
          }
          updatedAuthors.push(foundAuthor);
        }
      }
      if (updatedAuthors.length > 0) {
        book.authors = updatedAuthors;
      }
    }
  }
}
