/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { graphql, path } from '../../../support/rest.js';

/**
 * `@QuarkusTest` `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)` — the
 * tests are declared in `@Order` order, which is the order Vitest runs them in.
 */
describe('FileGraphQLIntegrationTest', () => {
  it('getFile_throwsGraphQLExceptionOnFailure', async () => {
    const response = await graphql(
      '{ getFile(objectName: "nonexistent.txt", bucketName: "test-bucket") ' +
        '{ objectName bucketName url content contentType size eTag } }',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'errors[0].message')).toContain(
      'Failed to retrieve object details from MinIO',
    );
  });

  it('uploadFile_returnsUploadedFileDetails', async () => {
    const response = await graphql(
      'mutation { uploadFile(objectName: "test.txt", bucketName: "test-bucket", ' +
        'content: "dGVzdCBjb250ZW50") { objectName bucketName url } }',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.uploadFile.objectName')).toBe('test.txt');
    expect(path(response, 'data.uploadFile.bucketName')).toBe('test-bucket');
    expect(path(response, 'data.uploadFile.url')).toContain('test-bucket/test.txt');
  });

  it('getFile_returnsFileDetails', async () => {
    const response = await graphql(
      '{ getFile(objectName: "test.txt", bucketName: "test-bucket") ' +
        '{ objectName bucketName url content contentType size eTag } }',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.getFile.objectName')).toBe('test.txt');
    expect(path(response, 'data.getFile.bucketName')).toBe('test-bucket');
    expect(path(response, 'data.getFile.url')).toContain('test-bucket/test.txt');
    expect(path(response, 'data.getFile.content')).toBe('dGVzdCBjb250ZW50');
    expect(path(response, 'data.getFile.contentType')).toBe('application/octet-stream');
    expect(path(response, 'data.getFile.size')).toBe(12);
    expect(path(response, 'data.getFile.eTag')).toBeNull();
  });

  it('deleteFile_returnsTrueOnSuccess', async () => {
    const response = await graphql(
      'mutation { deleteFile(objectName: "test.txt", bucketName: "test-bucket") }',
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.deleteFile')).toBe(true);
  });
});
