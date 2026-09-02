/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https';
import { once } from 'node:events';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import { execute, graphql, subscribe } from 'graphql';
import { useServer } from 'graphql-ws/use/ws';
import { Client as MinioClient } from 'minio';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';

import { applicationProperties, RESOURCES_ROOT } from './config/application-properties.js';
import {
  BookFrontBackCoverLoader,
  type Event,
  type UploadEvent,
} from './app/lifecycle/s3/book-front-back-cover-loader.js';
import { startMinioDevService, type MinioDevService } from './deps/minio-dev-service.js';
import {
  entityManager,
  enterSession,
  releaseSession,
  runInSession,
  startPersistenceUnit,
  stopPersistenceUnit,
} from './orm/panache/session.js';
import { MinioService } from './s3/service/minio-service.js';
import { APPLICATION_PATH } from './ws/application.js';
import { AuthorGraphQL } from './ws/graphql/api/author-graphql.js';
import { BookGraphQL } from './ws/graphql/api/book-graphql.js';
import { EditorGraphQL } from './ws/graphql/api/editor-graphql.js';
import { FileGraphQL } from './ws/graphql/api/file-graphql.js';
import { buildSchema } from './ws/graphql/schema.js';
import { GenericExceptionMapper } from './ws/mappers/errors/generic-exception-mapper.js';
import {
  AuthorResource,
  registerAuthorResource,
} from './ws/resources/endpoint/repository/v1/author-resource.js';
import {
  BookResource,
  registerBookResource,
} from './ws/resources/endpoint/repository/v1/book-resource.js';
import {
  EditorResource,
  registerEditorResource,
} from './ws/resources/endpoint/repository/v1/editor-resource.js';
import {
  FileResource,
  registerFileResource,
} from './ws/resources/endpoint/s3/v1/file-resource.js';

/** The running application: the HTTP layer plus the beans the tests reach for. */
export interface Application {
  readonly fastify: FastifyInstance;
  readonly minioService: MinioService;
  listen(port?: number): Promise<string>;
  /** The `https://…` address, once `listenSecure` has bound one. */
  listenSecure(port?: number): Promise<string>;
  close(): Promise<void>;
}

/**
 * Loads the PKCS12 key store named by
 * `quarkus.http.ssl.certificate.key-store-file`. Outside %prod the value is a
 * classpath resource; in %prod it is the absolute path of a mounted secret.
 */
function readKeyStore(): Buffer | null {
  const file = applicationProperties.http.keyStoreFile;
  if (file === '') {
    return null;
  }
  const path = isAbsolute(file) ? file : resolvePath(RESOURCES_ROOT, file);
  try {
    return readFileSync(path);
  } catch {
    // Quarkus starts without TLS when the key store cannot be read.
    return null;
  }
}

interface GraphQLRequestBody {
  query?: string;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
}

/**
 * Wires the application together: the persistence unit, the object store, the
 * CDI beans, the JAX-RS resources and the GraphQL endpoint.
 *
 * This is the assembly Quarkus performs from the annotations at build time.
 */
export async function createApplication(): Promise<Application> {
  await startPersistenceUnit();

  // Outside %prod no object store is configured, so Dev Services provides one.
  let devService: MinioDevService | null = null;
  let { url, accessKey, secretKey } = applicationProperties.minio;
  if (url === '') {
    devService = await startMinioDevService();
    url = devService.url;
    accessKey = devService.accessKey;
    secretKey = devService.secretKey;
  }

  const endpoint = new URL(url);
  const minioClient = new MinioClient({
    endPoint: endpoint.hostname,
    port: Number(endpoint.port === '' ? (endpoint.protocol === 'https:' ? 443 : 80) : endpoint.port),
    useSSL: endpoint.protocol === 'https:',
    accessKey,
    secretKey,
    region: 'us-east-1',
  });

  const minioService = new MinioService(minioClient);

  const authorGraphQL = new AuthorGraphQL();
  const editorGraphQL = new EditorGraphQL();
  const bookGraphQL = new BookGraphQL(entityManager);
  const fileGraphQL = new FileGraphQL(minioService);
  const schema = buildSchema({ authorGraphQL, editorGraphQL, bookGraphQL, fileGraphQL });

  const exceptionMapper = new GenericExceptionMapper();

  const fastify = Fastify({ logger: false });

  await fastify.register(compress, {
    global: true,
    customTypes: new RegExp(
      `^(${applicationProperties.http.compressMediaTypes
        .map((type) => type.replace('/', '\\/'))
        .join('|')})`,
    ),
  });
  await fastify.register(multipart);

  // One persistence context per request, entered before any handler runs and
  // given back — connection included — once the reply is on the wire.
  fastify.addHook('onRequest', (_request, _reply, done) => {
    enterSession(done);
  });
  fastify.addHook('onResponse', (_request, _reply, done) => {
    releaseSession();
    done();
  });

  fastify.setErrorHandler((error, _request, reply) => {
    const { status, body } = exceptionMapper.toResponse(error);
    void reply.code(status).send(body);
  });

  await fastify.register(
    async (instance: FastifyInstance): Promise<void> => {
      registerAuthorResource(instance, new AuthorResource());
      registerBookResource(instance, new BookResource());
      registerEditorResource(instance, new EditorResource());
      registerFileResource(instance, new FileResource(minioService));
    },
    { prefix: APPLICATION_PATH },
  );

  // `quarkus.smallrye-graphql.root-path=api/graphql`
  const graphqlPath = `/${applicationProperties.graphql.rootPath}`;
  fastify.post<{ Body: GraphQLRequestBody }>(graphqlPath, async (request, reply) => {
    const body = request.body;
    const result = await graphql({
      schema,
      source: body.query ?? '',
      variableValues: body.variables ?? undefined,
      operationName: body.operationName ?? undefined,
    });
    // SmallRye answers 200 for every GraphQL request, errors included.
    return reply.code(200).send(result);
  });

  // The `bookCreated` subscription, over the graphql-transport-ws protocol.
  const webSocketServer = new WebSocketServer({ noServer: true });
  useServer(
    {
      schema,
      execute: (args) => runInSession(() => execute(args)),
      subscribe: (args) => runInSession(() => subscribe(args)),
    },
    webSocketServer,
  );
  fastify.server.on('upgrade', (request, socket, head) => {
    const requested = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (requested !== graphqlPath) {
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      webSocketServer.emit('connection', client, request);
    });
  });

  // `@Observes StartupEvent` — upload the cover images and link them to books.
  let coverLoader: BookFrontBackCoverLoader | undefined;
  const uploadEvent: Event<UploadEvent> = {
    fire: async (event: UploadEvent): Promise<void> => {
      await (coverLoader as BookFrontBackCoverLoader).onUploadEvent(event);
    },
  };
  coverLoader = new BookFrontBackCoverLoader(minioService, uploadEvent, entityManager);
  await runInSession(() => coverLoader.onBookFrontCoverUpload());

  // `quarkus.http.ssl.certificate.*` — the same routes, also over TLS.
  let httpsServer: HttpsServer | null = null;

  return {
    fastify,
    minioService,
    async listen(port: number = applicationProperties.http.port): Promise<string> {
      return await fastify.listen({ port, host: '127.0.0.1' });
    },
    async listenSecure(port: number = applicationProperties.http.sslPort): Promise<string> {
      const keyStore = readKeyStore();
      if (keyStore === null) {
        throw new Error(
          `Cannot read the key store '${applicationProperties.http.keyStoreFile}'`,
        );
      }
      await fastify.ready();
      const server = createHttpsServer({
        pfx: keyStore,
        passphrase: applicationProperties.http.keyStorePassword,
      });
      server.on('request', (request, response) => {
        fastify.routing(request, response);
      });
      server.listen(port, '127.0.0.1');
      await once(server, 'listening');
      httpsServer = server;
      const address = server.address() as AddressInfo;
      return `https://127.0.0.1:${String(address.port)}`;
    },
    async close(): Promise<void> {
      webSocketServer.close();
      if (httpsServer !== null) {
        httpsServer.closeAllConnections();
        httpsServer.close();
        await once(httpsServer, 'close');
      }
      await fastify.close();
      await devService?.stop();
      await stopPersistenceUnit();
    },
  };
}
