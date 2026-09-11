/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Status, WebApplicationException } from '../../../../../../src/deps/jaxrs.js';
import type { MinioService } from '../../../../../../src/s3/service/minio-service.js';
import {
  FileResource,
  type FileUpload,
} from '../../../../../../src/ws/resources/endpoint/s3/v1/file-resource.js';

/**
 * A unit test: `MinioService` is a mock and `FileResource` is exercised
 * directly, never over HTTP. Mockito's `@Mock` / `@InjectMocks` /
 * `MockitoAnnotations.openMocks` become Vitest mock functions rebuilt in
 * `beforeEach`.
 */
describe('FileResourceTest', () => {
  let minioService: MinioService;
  let fileResource: FileResource;

  beforeEach(() => {
    minioService = {
      uploadObject: vi.fn(),
      getObjectDetails: vi.fn(),
      getObject: vi.fn(),
    } as unknown as MinioService;
    fileResource = new FileResource(minioService);
  });

  it('uploadFileSuccessfully', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const fileUpload: FileUpload = { filePath: vi.fn(() => 'test-file-path') };

    const objectDetails: Record<string, unknown> = {};
    objectDetails['key'] = 'value';
    vi.mocked(minioService.getObjectDetails).mockResolvedValue(objectDetails);

    const response = await fileResource.uploadFile(bucketName, objectName, fileUpload);

    expect(response.getStatus()).toBe(Status.OK);
    expect(response.getEntity()).toBe(objectDetails);
    expect(minioService.uploadObject).toHaveBeenCalledWith(
      bucketName,
      objectName,
      'test-file-path',
    );
  });

  it('uploadFileThrowsException', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const fileUpload: FileUpload = { filePath: vi.fn(() => 'test-file-path') };

    vi.mocked(minioService.uploadObject).mockRejectedValue(new Error('Upload failed'));

    await expect(
      fileResource.uploadFile(bucketName, objectName, fileUpload),
    ).rejects.toBeInstanceOf(WebApplicationException);
  });

  it('downloadFileSuccessfully', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const fileStream = Readable.from([Buffer.from('file-content')]);
    vi.mocked(minioService.getObject).mockResolvedValue(fileStream);

    const response = await fileResource.downloadFile(bucketName, objectName);

    expect(response.getStatus()).toBe(Status.OK);
    expect(response.getEntity()).toBe(fileStream);
    expect(response.getHeaderString('Content-Disposition')).toBe(
      `attachment; filename="${objectName}"`,
    );
  });

  it('downloadFileThrowsException', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';

    vi.mocked(minioService.getObject).mockRejectedValue(
      new WebApplicationException('Download failed'),
    );

    await expect(
      fileResource.downloadFile(bucketName, objectName),
    ).rejects.toBeInstanceOf(WebApplicationException);
  });
});
