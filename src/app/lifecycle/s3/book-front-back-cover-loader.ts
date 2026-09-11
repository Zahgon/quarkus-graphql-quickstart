/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { RESOURCES_ROOT } from '../../../config/application-properties.js';
import { logger } from '../../../deps/log.js';
import { Book } from '../../../orm/panache/entity/book.js';
import type { InjectedEntityManager } from '../../../orm/panache/session.js';
import { transactional } from '../../../orm/panache/session.js';
import type { MinioService } from '../../../s3/service/minio-service.js';

const Log = logger(
  'it.dontesta.labs.quarkus.graphql.app.lifecycle.s3.BookFrontBackCoverLoader',
);

/** Event class to hold the upload event data. */
export interface UploadEvent {
  readonly bucketName: string;
  readonly uploadedFiles: readonly string[];
}

/**
 * `jakarta.enterprise.event.Event<T>` — the injected emitter a bean uses to
 * fire an event at whichever beans observe it.
 */
export interface Event<T> {
  fire(event: T): Promise<void>;
}

/**
 * This class handles the uploading of book front and back cover images to Minio
 * from a specified resource folder.
 */
export class BookFrontBackCoverLoader {
  /**
   * Constructor to inject the MinioService and Event.
   *
   * @param minioService the MinioService to be injected
   * @param uploadEvent the Event to be injected
   * @param entityManager the EntityManager to be injected
   */
  constructor(
    private readonly minioService: MinioService,
    private readonly uploadEvent: Event<UploadEvent>,
    private readonly entityManager: InjectedEntityManager,
  ) {}

  /**
   * Event listener method that triggers on application startup to upload book
   * front and back cover images to Minio.
   */
  async onBookFrontCoverUpload(): Promise<void> {
    // This is the bucket name where the book front and back cover images will be uploaded
    // This value should be getting from the application configuration
    const bucketName = 'book-cover';

    // List of book front and back cover image files
    // This file are located in the resources folder
    const imageFiles: string[] = [
      'data/book/images/9780321967974_the_art_of_software_engineering_back_cover.jpg',
      'data/book/images/9780321967974_the_art_of_software_engineering_front_cover.jpg',
      'data/book/images/9780596805190_machine_learning_algorithms_back_cover.jpg',
      'data/book/images/9780596805190_machine_learning_algorithms_front_cover.jpg',
      'data/book/images/9780785316371_networked_neural_strategy_back_cover.jpg',
      'data/book/images/9780785316371_networked_neural_strategy_front_cover.jpg',
      'data/book/images/9780810885720_algorithmic_pattern_analysis_back_cover.jpg',
      'data/book/images/9780810885720_algorithmic_pattern_analysis_front_cover.jpg',
      'data/book/images/9781501582327_introduction_to_data_science_back_cover.jpg',
      'data/book/images/9781501582327_introduction_to_data_science_front_cover.jpg',
    ];

    const uploadedFiles: string[] = [];

    for (const imageFilePath of imageFiles) {
      try {
        const content = await readFile(resolve(RESOURCES_ROOT, imageFilePath));
        const fileName = basename(imageFilePath);
        await this.minioService.uploadObject(bucketName, fileName, content);
        uploadedFiles.push(fileName);
        Log.debugf(
          'Uploaded book front and back cover image: {%s} to Minio into bucket name {%s}',
          fileName,
          bucketName,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          Log.warnf('Resource file not found: {%s}', imageFilePath);
        } else {
          Log.errorf(
            'Error uploading book front and back cover image: {%s} to Minio',
            imageFilePath,
            error,
          );
        }
      }
    }

    // Send the upload event with bucket name and list of uploaded files
    await this.uploadEvent.fire({ bucketName, uploadedFiles });
  }

  /**
   * Event listener method to handle the upload event and update Book entities.
   *
   * @param event the upload event
   */
  async onUploadEvent(event: UploadEvent): Promise<void> {
    const { bucketName, uploadedFiles } = event;

    Log.infof(
      'Received upload event for bucket name {%s} with uploaded files: {%s} to update the related book',
      bucketName,
      uploadedFiles.join(', '),
    );

    const groups = new Map<string, string[]>();
    for (const fileName of uploadedFiles) {
      if (!fileName.endsWith('front_cover.jpg') && !fileName.endsWith('back_cover.jpg')) {
        continue;
      }
      const key = fileName.replace(/_(front|back)_cover\.jpg$/, '');
      const group = groups.get(key);
      if (group === undefined) {
        groups.set(key, [fileName]);
      } else {
        group.push(fileName);
      }
    }

    const coverPairs = new Map<string, string>();
    for (const group of groups.values()) {
      if (group.length !== 2) {
        continue;
      }
      const front = group.find((name) => name.endsWith('front_cover.jpg'));
      const back = group.find((name) => name.endsWith('back_cover.jpg'));
      if (front === undefined || back === undefined) {
        throw new Error('No value present');
      }
      coverPairs.set(front, back);
    }

    // Logic to update Book entities with front and back cover URLs
    for (const [frontCover, backCover] of coverPairs) {
      const isbn = frontCover.split('_')[0] as string;

      const frontCoverDetails = await this.minioService.getObjectDetails(bucketName, frontCover);
      const backCoverDetails = await this.minioService.getObjectDetails(bucketName, backCover);

      await transactional(async () => {
        const book = await Book.findBookByQuery('isbn', isbn);
        if (book === null) {
          return;
        }
        const frontCoverUrl = String(frontCoverDetails['downloadUrl']);
        const backCoverUrl = String(backCoverDetails['downloadUrl']);

        book.frontCoverImageUrl = frontCoverUrl;
        book.backCoverImageUrl = backCoverUrl;

        // Update the Book entity
        await this.entityManager.merge(book);

        Log.debugf(
          'Updated Book entity with ISBN {%s} with front cover URL {%s} and back cover URL {%s}',
          isbn,
          frontCoverUrl,
          backCoverUrl,
        );
      });
    }
  }
}
