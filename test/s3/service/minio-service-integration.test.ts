/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { MinioServiceException } from '../../../src/exception/minio-service-exception.js';
import { minioService } from '../../support/application.js';

/**
 * `@QuarkusTest` `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)`.
 *
 * `MethodOrderer.OrderAnnotation` runs the annotated methods first, in `@Order`
 * order, and leaves the rest in their original relative order. The two
 * `@Order` methods are therefore declared first here, followed by the other
 * thirteen in the order the Java class declares them.
 */
describe('MinioServiceIntegrationTest', () => {
  // @Order(1)
  it('removeObjectThrowsExceptionWithCorrectMessage', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'non-existing-object';

    const exception = await minioService().then((service) =>
      service.removeObject(bucketName, objectName).catch((error: unknown) => error),
    );

    expect(exception).toBeInstanceOf(MinioServiceException);
    expect((exception as MinioServiceException).message).toBe(
      'Failed to remove object from MinIO',
    );
  });

  // @Order(2)
  it('bucketExistsReturnsTrueForExistingBucket', async () => {
    const bucketName = 'test-bucket';
    await (await minioService()).makeBucket(bucketName);

    const exists = await (await minioService()).bucketExists(bucketName);
    expect(exists).toBe(true);
  });

  it('uploadObjectWithValidFilePath', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const filePath = 'src/test/resources/test-file.txt';

    await (await minioService()).uploadObject(bucketName, objectName, filePath);

    const object = await (await minioService()).getObject(bucketName, objectName);
    expect(object).not.toBeNull();
  });

  it('uploadObjectWithEmptyFileThrowsException', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const filePath = 'src/test/resources/empty-file.txt';

    await expect(
      (await minioService()).uploadObject(bucketName, objectName, filePath),
    ).rejects.toBeInstanceOf(MinioServiceException);
  });

  it('uploadObjectWithValidByteArray', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const fileContent = Buffer.from('This is a test file content');

    await (await minioService()).uploadObject(bucketName, objectName, fileContent);

    const object = await (await minioService()).getObject(bucketName, objectName);
    expect(object).not.toBeNull();
  });

  it('getObjectAsBase64ReturnsCorrectString', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const fileContent = Buffer.from('This is a test file content');
    await (await minioService()).uploadObject(bucketName, objectName, fileContent);

    const base64Content = await (await minioService()).getObjectAsBase64(bucketName, objectName);
    expect(base64Content).toBe(fileContent.toString('base64'));
  });

  it('bucketExistsReturnsFalseForNonExistingBucket', async () => {
    const bucketName = 'non-existing-bucket';

    const exists = await (await minioService()).bucketExists(bucketName);
    expect(exists).toBe(false);
  });

  it('getObjectDetailsReturnsCorrectDetails', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const fileContent = Buffer.from('This is a test file content');
    await (await minioService()).uploadObject(bucketName, objectName, fileContent);

    const details = await (await minioService()).getObjectDetails(bucketName, objectName);
    expect(details['bucketName']).toBe(bucketName);
    expect(details['objectName']).toBe(objectName);
    expect(details['size']).toBe(fileContent.length);
  });

  it('removeObjectRemovesObjectSuccessfully', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const fileContent = Buffer.from('This is a test file content');
    await (await minioService()).uploadObject(bucketName, objectName, fileContent);

    await (await minioService()).removeObject(bucketName, objectName);

    await expect(
      (await minioService()).getObject(bucketName, objectName),
    ).rejects.toBeInstanceOf(MinioServiceException);
  });

  it('getObjectDetailsThrowsExceptionWithCorrectMessage', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'non-existing-object';

    const exception = await (await minioService())
      .getObjectDetails(bucketName, objectName)
      .catch((error: unknown) => error);

    expect(exception).toBeInstanceOf(MinioServiceException);
    expect((exception as MinioServiceException).message).toBe(
      'Failed to retrieve object details from MinIO',
    );
  });

  it('getObjectAsBase64ThrowsExceptionWithCorrectMessage', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'non-existing-object';

    const exception = await (await minioService())
      .getObjectAsBase64(bucketName, objectName)
      .catch((error: unknown) => error);

    expect(exception).toBeInstanceOf(MinioServiceException);
    expect((exception as MinioServiceException).message).toBe(
      'Failed to retrieve object from MinIO',
    );
  });

  it('uploadObjectThrowsMinioServiceException', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const invalidFilePath = 'src/test/resources/non-existent-file.txt'; // Non-existent file path

    const exception = await (await minioService())
      .uploadObject(bucketName, objectName, invalidFilePath)
      .catch((error: unknown) => error);

    expect(exception).toBeInstanceOf(MinioServiceException);
    expect((exception as MinioServiceException).message).toBe(
      'Failed to upload object to MinIO',
    );
  });

  it('uploadObjectCreatesBucketIfNotExists', async () => {
    const bucketName = 'new-bucket';
    const objectName = 'test-object';
    const filePath = 'src/test/resources/test-file.txt';
    const service = await minioService();

    // Ensure the bucket does not exist before the test
    if (await service.bucketExists(bucketName)) {
      await service.removeObject(bucketName, objectName);
    }

    // Upload the object, which should trigger bucket creation
    await service.uploadObject(bucketName, objectName, filePath);

    // Verify the bucket was created
    const bucketExists = await service.bucketExists(bucketName);
    expect(bucketExists).toBe(true);

    // Clean up by removing the object and bucket
    await service.removeObject(bucketName, objectName);
  });

  it('bucketExistsThrowsMinioServiceException', async () => {
    const invalidBucketName = 'invalidBucketName';

    const exception = await (await minioService())
      .bucketExists(invalidBucketName)
      .catch((error: unknown) => error);

    expect(exception).toBeInstanceOf(MinioServiceException);
    expect((exception as MinioServiceException).message).toBe('Failed to check bucket existence');
  });

  it('makeBucketThrowsMinioServiceException', async () => {
    const invalidBucketName = 'invalidBucketName';

    const exception = await (await minioService())
      .makeBucket(invalidBucketName)
      .catch((error: unknown) => error);

    expect(exception).toBeInstanceOf(MinioServiceException);
    expect((exception as MinioServiceException).message).toBe('Failed to create bucket');
  });
});
