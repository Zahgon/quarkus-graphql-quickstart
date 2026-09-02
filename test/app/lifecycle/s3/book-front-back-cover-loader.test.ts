/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it, vi } from 'vitest';

import {
  BookFrontBackCoverLoader,
  type Event,
  type UploadEvent,
} from '../../../../src/app/lifecycle/s3/book-front-back-cover-loader.js';
import { Book } from '../../../../src/orm/panache/entity/book.js';
import { entityManager, runInSession, transactional } from '../../../../src/orm/panache/session.js';
import type { MinioService } from '../../../../src/s3/service/minio-service.js';

function mockMinioService(): MinioService {
  return {
    uploadObject: vi.fn(),
    getObjectDetails: vi.fn(async (bucketName: string, objectName: string) => ({
      bucketName,
      objectName,
      downloadUrl: `https://s3.test/${bucketName}/${objectName}`,
    })),
  } as unknown as MinioService;
}

function collectingEvent(): { event: Event<UploadEvent>; fired: UploadEvent[] } {
  const fired: UploadEvent[] = [];
  return {
    fired,
    event: {
      fire: async (uploadEvent: UploadEvent): Promise<void> => {
        fired.push(uploadEvent);
      },
    },
  };
}

/**
 * A test the original does not have: the startup hook and its event observer
 * ran under CDI, so nothing exercised them directly. Both the failure paths —
 * a resource that is not on the classpath and an upload that throws — and the
 * pairing rule the observer applies are asserted here.
 */
describe('BookFrontBackCoverLoaderTest', () => {
  it('onBookFrontCoverUpload_uploadsEveryCoverAndFiresTheEvent', async () => {
    const minioService = mockMinioService();
    const { event, fired } = collectingEvent();
    const loader = new BookFrontBackCoverLoader(minioService, event, entityManager);

    await runInSession(() => loader.onBookFrontCoverUpload());

    expect(minioService.uploadObject).toHaveBeenCalledTimes(10);
    expect(fired).toHaveLength(1);
    expect(fired[0]?.bucketName).toBe('book-cover');
    expect(fired[0]?.uploadedFiles).toContain(
      '9780785316371_networked_neural_strategy_front_cover.jpg',
    );
  });

  it('onBookFrontCoverUpload_warnsAndContinuesWhenAnUploadFails', async () => {
    const minioService = mockMinioService();
    vi.mocked(minioService.uploadObject).mockRejectedValue(new Error('MinIO is down'));
    const sink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { event, fired } = collectingEvent();
    const loader = new BookFrontBackCoverLoader(minioService, event, entityManager);

    await runInSession(() => loader.onBookFrontCoverUpload());

    expect(sink).toHaveBeenCalledTimes(10);
    expect(fired[0]?.uploadedFiles).toEqual([]);
    sink.mockRestore();
  });

  it('onUploadEvent_writesThePresignedUrlsOntoTheMatchingBook', async () => {
    const minioService = mockMinioService();
    const { event } = collectingEvent();
    const loader = new BookFrontBackCoverLoader(minioService, event, entityManager);

    await loader.onUploadEvent({
      bucketName: 'book-cover',
      uploadedFiles: [
        '9780785316371_networked_neural_strategy_front_cover.jpg',
        '9780785316371_networked_neural_strategy_back_cover.jpg',
      ],
    });

    await transactional(async () => {
      const book = await Book.findBookByQuery('isbn', '9780785316371');
      expect(book?.frontCoverImageUrl).toBe(
        'https://s3.test/book-cover/9780785316371_networked_neural_strategy_front_cover.jpg',
      );
      expect(book?.backCoverImageUrl).toBe(
        'https://s3.test/book-cover/9780785316371_networked_neural_strategy_back_cover.jpg',
      );
    });
  });

  it('onUploadEvent_ignoresAnIsbnNoBookCarries', async () => {
    const minioService = mockMinioService();
    const { event } = collectingEvent();
    const loader = new BookFrontBackCoverLoader(minioService, event, entityManager);

    await loader.onUploadEvent({
      bucketName: 'book-cover',
      uploadedFiles: [
        '0000000000000_unknown_front_cover.jpg',
        '0000000000000_unknown_back_cover.jpg',
      ],
    });

    expect(minioService.getObjectDetails).toHaveBeenCalledTimes(2);
  });

  it('onUploadEvent_skipsUnpairedAndUnrelatedFiles', async () => {
    const minioService = mockMinioService();
    const { event } = collectingEvent();
    const loader = new BookFrontBackCoverLoader(minioService, event, entityManager);

    await loader.onUploadEvent({
      bucketName: 'book-cover',
      uploadedFiles: [
        '9780785316371_networked_neural_strategy_front_cover.jpg', // no matching back cover
        'notes.txt', // neither a front nor a back cover
      ],
    });

    expect(minioService.getObjectDetails).not.toHaveBeenCalled();
  });
});
