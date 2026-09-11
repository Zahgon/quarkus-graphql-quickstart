/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startMinioDevService, type MinioDevService } from '../../src/deps/minio-dev-service.js';

/**
 * A test the original does not have.
 *
 * Quarkus Dev Services started a MinIO container; the port stands one up
 * in-process instead. It is only a stand-in if it answers the way MinIO does,
 * including the error codes `MinioServiceException` is derived from — so the S3
 * subset it implements is driven here directly, without the client in between.
 */
describe('MinioDevServiceTest', () => {
  let service: MinioDevService;

  beforeAll(async () => {
    service = await startMinioDevService();
  });

  afterAll(async () => {
    await service.stop();
  });

  it('startMinioDevService_publishesAnAddressAndCredentials', () => {
    expect(service.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(service.accessKey).toBe('minioaccess');
    expect(service.secretKey).toBe('miniosecret');
  });

  it('headBucket_is404UntilTheBucketIsCreated', async () => {
    expect((await fetch(`${service.url}/absent`, { method: 'HEAD' })).status).toBe(404);

    expect((await fetch(`${service.url}/made`, { method: 'PUT' })).status).toBe(200);
    expect((await fetch(`${service.url}/made`, { method: 'HEAD' })).status).toBe(200);
    expect((await fetch(`${service.url}/made`)).status).toBe(200);
  });

  it('putBucket_reportsBucketAlreadyOwnedByYouTheSecondTime', async () => {
    await fetch(`${service.url}/twice`, { method: 'PUT' });
    const response = await fetch(`${service.url}/twice`, { method: 'PUT' });

    expect(response.status).toBe(409);
    expect(await response.text()).toContain('<Code>BucketAlreadyOwnedByYou</Code>');
  });

  it('object_roundTripsThroughPutGetHeadAndDelete', async () => {
    await fetch(`${service.url}/objects`, { method: 'PUT' });

    const stored = await fetch(`${service.url}/objects/note.txt`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect(stored.status).toBe(200);
    expect(stored.headers.get('ETag')).toMatch(/^"[0-9a-f]{32}"$/);

    const fetched = await fetch(`${service.url}/objects/note.txt`);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get('Content-Type')).toBe('text/plain');
    expect(await fetched.text()).toBe('hello');

    const head = await fetch(`${service.url}/objects/note.txt`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('Content-Length')).toBe('5');
    expect(await head.text()).toBe('');

    expect((await fetch(`${service.url}/objects/note.txt`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await fetch(`${service.url}/objects/note.txt`)).status).toBe(404);
  });

  it('object_storedWithoutAContentTypeGetsMinIOsOwnDefault', async () => {
    await fetch(`${service.url}/defaults`, { method: 'PUT' });
    // A byte payload carries no Content-Type of its own, which is the case
    // MinIO answers for.
    await fetch(`${service.url}/defaults/blob`, {
      method: 'PUT',
      body: new Uint8Array([114, 97, 119]),
    });

    const head = await fetch(`${service.url}/defaults/blob`, { method: 'HEAD' });
    expect(head.headers.get('Content-Type')).toBe('binary/octet-stream');
  });

  it('missingBucket_answersNoSuchBucketForEveryObjectVerb', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'DELETE']) {
      const response = await fetch(`${service.url}/nowhere/object`, { method });
      expect(response.status).toBe(404);
    }
    expect(await (await fetch(`${service.url}/nowhere/object`)).text()).toContain(
      '<Code>NoSuchBucket</Code>',
    );
  });

  it('missingKey_answersNoSuchKey', async () => {
    await fetch(`${service.url}/present`, { method: 'PUT' });
    const response = await fetch(`${service.url}/present/absent`);

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('<Code>NoSuchKey</Code>');
  });

  it('unsupportedRequests_answerMethodNotAllowed', async () => {
    expect((await fetch(`${service.url}/`, { method: 'GET' })).status).toBe(405);
    expect((await fetch(`${service.url}/bucket`, { method: 'DELETE' })).status).toBe(405);

    await fetch(`${service.url}/patched`, { method: 'PUT' });
    expect((await fetch(`${service.url}/patched/object`, { method: 'PATCH' })).status).toBe(405);
  });
});
