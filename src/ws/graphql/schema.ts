/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import {
  GraphQLBoolean,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  Kind,
} from 'graphql';
import type { GraphQLFieldConfigMap, GraphQLInputFieldConfigMap } from 'graphql';

import { Author } from '../../orm/panache/entity/author.js';
import { Book } from '../../orm/panache/entity/book.js';
import { Editor } from '../../orm/panache/entity/editor.js';
import { fromJson } from '../../orm/panache/json.js';
import { LocalDate } from '../../orm/panache/local-date.js';
import { currentEntityManager } from '../../orm/panache/session.js';
import type { AuthorGraphQL } from './api/author-graphql.js';
import type { BookGraphQL } from './api/book-graphql.js';
import type { EditorGraphQL } from './api/editor-graphql.js';
import type { FileGraphQL } from './api/file-graphql.js';

/**
 * The GraphQL schema.
 *
 * SmallRye GraphQL builds this by reflecting over the `@GraphQLApi` beans:
 * a method name becomes a field name (with `get` stripped, and `@Query("…")` /
 * `@Name("…")` overriding), a parameter becomes an argument, and an entity
 * becomes an object type plus a matching `…Input`. TypeScript has no
 * equivalent reflection, so the schema those rules produce is written out here
 * — the names, arguments and nullability are the same ones the original
 * publishes.
 */

/** SmallRye maps `java.lang.Long` onto the `BigInteger` scalar. */
const BigIntegerScalar = new GraphQLScalarType<number | null, number | null>({
  name: 'BigInteger',
  description: 'Scalar for BigInteger',
  serialize: (value) => (value === null || value === undefined ? null : Number(value)),
  parseValue: (value) => (value === null || value === undefined ? null : Number(value)),
  parseLiteral: (node) =>
    node.kind === Kind.INT || node.kind === Kind.STRING ? Number(node.value) : null,
});

/** SmallRye maps `java.time.LocalDate` onto `Date`, formatted `yyyy-MM-dd`. */
const DateScalar = new GraphQLScalarType<string | null, string | null>({
  name: 'Date',
  description: 'Scalar for java.time.LocalDate',
  serialize: (value) => (value === null || value === undefined ? null : String(value)),
  parseValue: (value) =>
    value === null || value === undefined ? null : LocalDate.parse(String(value)),
  parseLiteral: (node) =>
    node.kind === Kind.STRING ? LocalDate.parse(node.value) : null,
});

/** Resolves an inverse association the way an open Hibernate session would. */
function inverseResolver(owner: typeof Author | typeof Editor, property: string) {
  return async (source: Author | Editor): Promise<unknown[]> =>
    await (
      await currentEntityManager()
    ).loadInverse(
      source as unknown as { id: number | null } & Record<string, unknown>,
      owner.metadata,
      property,
    );
}

const AuthorType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Author',
  fields: (): GraphQLFieldConfigMap<Author, unknown> => ({
    id: { type: BigIntegerScalar },
    firstName: { type: GraphQLString },
    lastName: { type: GraphQLString },
    sex: { type: GraphQLString },
    birthDate: { type: DateScalar },
    books: { type: new GraphQLList(BookType), resolve: inverseResolver(Author, 'books') },
  }),
});

const EditorType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Editor',
  fields: (): GraphQLFieldConfigMap<Editor, unknown> => ({
    id: { type: BigIntegerScalar },
    name: { type: GraphQLString },
    books: { type: new GraphQLList(BookType), resolve: inverseResolver(Editor, 'books') },
  }),
});

const BookType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Book',
  fields: (): GraphQLFieldConfigMap<Book, unknown> => ({
    id: { type: BigIntegerScalar },
    title: { type: GraphQLString },
    subTitle: { type: GraphQLString },
    isbn: { type: GraphQLString },
    pages: { type: GraphQLInt },
    summary: { type: GraphQLString },
    publication: { type: DateScalar },
    genre: { type: GraphQLString },
    frontCoverImageUrl: { type: GraphQLString },
    backCoverImageUrl: { type: GraphQLString },
    languages: { type: new GraphQLList(GraphQLString) },
    formats: { type: new GraphQLList(GraphQLString) },
    keywords: { type: new GraphQLList(GraphQLString) },
    authors: { type: new GraphQLList(AuthorType) },
    editor: { type: EditorType },
  }),
});

const AuthorInput: GraphQLInputObjectType = new GraphQLInputObjectType({
  name: 'AuthorInput',
  fields: (): GraphQLInputFieldConfigMap => ({
    id: { type: BigIntegerScalar },
    firstName: { type: GraphQLString },
    lastName: { type: GraphQLString },
    sex: { type: GraphQLString },
    birthDate: { type: DateScalar },
    books: { type: new GraphQLList(BookInput) },
  }),
});

const EditorInput: GraphQLInputObjectType = new GraphQLInputObjectType({
  name: 'EditorInput',
  fields: (): GraphQLInputFieldConfigMap => ({
    id: { type: BigIntegerScalar },
    name: { type: GraphQLString },
    books: { type: new GraphQLList(BookInput) },
  }),
});

const BookInput: GraphQLInputObjectType = new GraphQLInputObjectType({
  name: 'BookInput',
  fields: (): GraphQLInputFieldConfigMap => ({
    id: { type: BigIntegerScalar },
    title: { type: GraphQLString },
    subTitle: { type: GraphQLString },
    isbn: { type: GraphQLString },
    pages: { type: GraphQLInt },
    summary: { type: GraphQLString },
    publication: { type: DateScalar },
    genre: { type: GraphQLString },
    frontCoverImageUrl: { type: GraphQLString },
    backCoverImageUrl: { type: GraphQLString },
    languages: { type: new GraphQLList(GraphQLString) },
    formats: { type: new GraphQLList(GraphQLString) },
    keywords: { type: new GraphQLList(GraphQLString) },
    authors: { type: new GraphQLList(AuthorInput) },
    editor: { type: EditorInput },
  }),
});

const BookEdgeType = new GraphQLObjectType({
  name: 'BookEdge',
  fields: {
    node: { type: BookType },
    cursor: { type: GraphQLString },
  },
});

const PageInfoType = new GraphQLObjectType({
  name: 'PageInfo',
  fields: {
    hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
    endCursor: { type: GraphQLString },
  },
});

const BookConnectionType = new GraphQLObjectType({
  name: 'BookConnection',
  fields: {
    edges: { type: new GraphQLList(BookEdgeType) },
    pageInfo: { type: PageInfoType },
  },
});

const FileDTOType = new GraphQLObjectType({
  name: 'FileDTO',
  description: 'Rappresenta un file con i dettagli',
  fields: {
    objectName: { type: GraphQLString },
    bucketName: { type: GraphQLString },
    url: { type: GraphQLString },
    content: { type: GraphQLString },
    contentType: { type: GraphQLString },
    size: { type: BigIntegerScalar },
    eTag: { type: GraphQLString },
  },
});

export interface GraphQLApis {
  readonly authorGraphQL: AuthorGraphQL;
  readonly editorGraphQL: EditorGraphQL;
  readonly bookGraphQL: BookGraphQL;
  readonly fileGraphQL: FileGraphQL;
}

export function buildSchema(apis: GraphQLApis): GraphQLSchema {
  const { authorGraphQL, editorGraphQL, bookGraphQL, fileGraphQL } = apis;

  const query = new GraphQLObjectType({
    name: 'Query',
    fields: {
      allAuthors: {
        type: new GraphQLList(AuthorType),
        description: 'Get all authors',
        resolve: async (): Promise<Author[]> => await authorGraphQL.allAuthors(),
      },
      author: {
        type: AuthorType,
        description: 'Get an author by id',
        args: { authorId: { type: BigIntegerScalar } },
        resolve: async (_source, args: { authorId: number | null }): Promise<Author | null> =>
          await authorGraphQL.getAuthor(args.authorId),
      },
      allEditors: {
        type: new GraphQLList(EditorType),
        description: 'Get all editors',
        resolve: async (): Promise<Editor[]> => await editorGraphQL.allEditors(),
      },
      editor: {
        type: EditorType,
        description: 'Get an editor by id',
        args: { editorId: { type: BigIntegerScalar } },
        resolve: async (_source, args: { editorId: number | null }): Promise<Editor | null> =>
          await editorGraphQL.getEditor(args.editorId),
      },
      allBooks: {
        type: new GraphQLList(BookType),
        description: 'Get all books',
        resolve: async (): Promise<Book[]> => await bookGraphQL.allBooks(),
      },
      book: {
        type: BookType,
        description: 'Get a book by id',
        args: { bookId: { type: BigIntegerScalar } },
        resolve: async (_source, args: { bookId: number | null }): Promise<Book | null> =>
          await bookGraphQL.getBook(args.bookId),
      },
      books: {
        type: BookConnectionType,
        args: {
          first: { type: new GraphQLNonNull(GraphQLInt) },
          after: { type: new GraphQLNonNull(GraphQLString) },
        },
        resolve: (_source, args: { first: number; after: string }) =>
          bookGraphQL.books(args.first, args.after),
      },
      getFile: {
        type: FileDTOType,
        description: 'Obtain a file from the S3 bucket',
        args: {
          objectName: { type: GraphQLString },
          bucketName: { type: GraphQLString },
        },
        resolve: (_source, args: { objectName: string; bucketName: string }) =>
          fileGraphQL.getFile(args.objectName, args.bucketName),
      },
    },
  });

  const mutation = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      createAuthor: {
        type: AuthorType,
        description: 'Create a new author',
        args: { author: { type: AuthorInput } },
        resolve: (_source, args: { author: unknown }): Promise<Author> =>
          authorGraphQL.createAuthor(fromJson(Author, args.author)),
      },
      updateAuthor: {
        type: AuthorType,
        description: 'Delete an author by id',
        args: {
          authorId: { type: BigIntegerScalar },
          authorData: { type: AuthorInput },
        },
        resolve: (_source, args: { authorId: number; authorData: unknown }): Promise<Author> =>
          authorGraphQL.updateAuthor(args.authorId, fromJson(Author, args.authorData)),
      },
      createEditor: {
        type: EditorType,
        description: 'Create a new editor',
        args: { editor: { type: EditorInput } },
        resolve: (_source, args: { editor: unknown }): Promise<Editor> =>
          editorGraphQL.createEditor(fromJson(Editor, args.editor)),
      },
      updateEditor: {
        type: EditorType,
        description: 'Delete an editor by id',
        args: {
          editorId: { type: BigIntegerScalar },
          editorData: { type: EditorInput },
        },
        resolve: (_source, args: { editorId: number; editorData: unknown }): Promise<Editor> =>
          editorGraphQL.updateEditor(args.editorId, fromJson(Editor, args.editorData)),
      },
      createBook: {
        type: BookType,
        description: 'Create a new book',
        args: { book: { type: BookInput } },
        resolve: (_source, args: { book: unknown }): Promise<Book> =>
          bookGraphQL.createBook(fromJson(Book, args.book)),
      },
      addAuthorsToBook: {
        type: BookType,
        description: 'Delete a book by id',
        args: {
          bookId: { type: BigIntegerScalar },
          authorIds: { type: new GraphQLList(BigIntegerScalar) },
        },
        resolve: (_source, args: { bookId: number; authorIds: number[] }): Promise<Book> =>
          bookGraphQL.addAuthorsToBook(args.bookId, args.authorIds),
      },
      uploadFile: {
        type: FileDTOType,
        description: 'Load a file into the S3 bucket',
        args: {
          objectName: { type: GraphQLString },
          bucketName: { type: GraphQLString },
          content: { type: GraphQLString },
        },
        resolve: (
          _source,
          args: { objectName: string; bucketName: string; content: string },
        ) => fileGraphQL.uploadFile(args.objectName, args.bucketName, args.content),
      },
      deleteFile: {
        type: GraphQLBoolean,
        description: 'Elimina un file dal bucket S3',
        args: {
          objectName: { type: GraphQLString },
          bucketName: { type: GraphQLString },
        },
        resolve: (_source, args: { objectName: string; bucketName: string }): Promise<boolean> =>
          fileGraphQL.deleteFile(args.objectName, args.bucketName),
      },
    },
  });

  const subscription = new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      bookCreated: {
        type: BookType,
        subscribe: (): AsyncIterable<Book> => bookGraphQL.bookCreated(),
        resolve: (payload: Book): Book => payload,
      },
    },
  });

  return new GraphQLSchema({ query, mutation, subscription });
}
