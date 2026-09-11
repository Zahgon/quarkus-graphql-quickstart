/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

/**
 * The Dev Services counterpart for MinIO.
 *
 * Outside `%prod` the original does not configure an object store at all:
 * `quarkus-minio` notices the missing address and Quarkus Dev Services starts a
 * MinIO container, injecting its URL and credentials into the client. There is
 * no Dev Services in Node, so the same guarantee — *an S3 endpoint is available
 * whenever one was not configured* — is met by this in-process server.
 *
 * It speaks the subset of the S3 REST API the application exercises, so the
 * production MinIO client is still the real one and still talks the real
 * protocol; only the peer is local. Everything the application observes comes
 * back off the wire, including the error codes that drive
 * `MinioServiceException`.
 */

interface StoredObject {
  readonly data: Buffer;
  readonly contentType: string;
  readonly etag: string;
  readonly lastModified: Date;
}

export interface MinioDevService {
  readonly url: string;
  readonly accessKey: string;
  readonly secretKey: string;
  stop(): Promise<void>;
}

const S3_ERRORS: Readonly<Record<string, { status: number; message: string }>> = {
  NoSuchBucket: { status: 404, message: 'The specified bucket does not exist' },
  NoSuchKey: { status: 404, message: 'The specified key does not exist.' },
  BucketAlreadyOwnedByYou: {
    status: 409,
    message: 'Your previous request to create the named bucket succeeded and you already own it.',
  },
  MethodNotAllowed: { status: 405, message: 'The specified method is not allowed' },
};

function sendError(response: ServerResponse, code: string, resource: string): void {
  const error = S3_ERRORS[code] ?? S3_ERRORS['MethodNotAllowed'];
  const status = error?.status ?? 405;
  const message = error?.message ?? 'The specified method is not allowed';
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<Error><Code>${code}</Code><Message>${message}</Message>` +
    `<Resource>${resource}</Resource><RequestId></RequestId></Error>`;
  response.writeHead(status, {
    'Content-Type': 'application/xml',
    'Content-Length': Buffer.byteLength(body),
  });
  // A HEAD reply carries the status and the headers but never the body.
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

/** Starts the embedded object store on an ephemeral port. */
export async function startMinioDevService(): Promise<MinioDevService> {
  const buckets = new Map<string, Map<string, StoredObject>>();

  const server: Server = createServer((request, response) => {
    void handle(request, response).catch(() => {
      response.writeHead(500).end();
    });
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const segments = url.pathname.split('/').filter((segment) => segment !== '');
    const bucketName = segments.length > 0 ? decodeURIComponent(segments[0] as string) : '';
    const objectName =
      segments.length > 1
        ? segments
            .slice(1)
            .map((segment) => decodeURIComponent(segment))
            .join('/')
        : '';
    const method = request.method ?? 'GET';
    const isHead = method === 'HEAD';

    if (bucketName === '') {
      sendError(response, 'MethodNotAllowed', url.pathname);
      return;
    }

    // Bucket-level requests.
    if (objectName === '') {
      if (method === 'PUT') {
        await readBody(request);
        if (buckets.has(bucketName)) {
          sendError(response, 'BucketAlreadyOwnedByYou', url.pathname);
          return;
        }
        buckets.set(bucketName, new Map<string, StoredObject>());
        response.writeHead(200, { 'Content-Length': 0 }).end();
        return;
      }
      if (isHead || method === 'GET') {
        if (!buckets.has(bucketName)) {
          sendError(response, 'NoSuchBucket', url.pathname);
          return;
        }
        response.writeHead(200, { 'Content-Length': 0 }).end();
        return;
      }
      sendError(response, 'MethodNotAllowed', url.pathname);
      return;
    }

    // Object-level requests.
    const bucket = buckets.get(bucketName);
    if (bucket === undefined) {
      sendError(response, 'NoSuchBucket', url.pathname);
      return;
    }

    if (method === 'PUT') {
      const data = await readBody(request);
      // MinIO's own default for an object stored without a content type.
      const contentType =
        (request.headers['content-type'] as string | undefined) ?? 'binary/octet-stream';
      const etag = createHash('md5').update(data).digest('hex');
      bucket.set(objectName, { data, contentType, etag, lastModified: new Date() });
      response
        .writeHead(200, { ETag: `"${etag}"`, 'Content-Length': 0 })
        .end();
      return;
    }

    if (method === 'DELETE') {
      bucket.delete(objectName);
      response.writeHead(204, { 'Content-Length': 0 }).end();
      return;
    }

    if (isHead || method === 'GET') {
      const stored = bucket.get(objectName);
      if (stored === undefined) {
        sendError(response, 'NoSuchKey', url.pathname);
        return;
      }
      response.writeHead(200, {
        'Content-Type': stored.contentType,
        'Content-Length': stored.data.length,
        ETag: `"${stored.etag}"`,
        'Last-Modified': stored.lastModified.toUTCString(),
      });
      response.end(isHead ? undefined : stored.data);
      return;
    }

    sendError(response, 'MethodNotAllowed', url.pathname);
  }

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    accessKey: 'minioaccess',
    secretKey: 'miniosecret',
    async stop(): Promise<void> {
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
    },
  };
}
