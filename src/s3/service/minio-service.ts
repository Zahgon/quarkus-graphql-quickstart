/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { statSync } from 'node:fs';
import type { Readable } from 'node:stream';

import type { Client as MinioClient } from 'minio';

import { notEmpty } from '../../deps/bean-validation.js';
import { logger } from '../../deps/log.js';
import { MinioServiceException } from '../../exception/minio-service-exception.js';

const Log = logger('it.dontesta.labs.quarkus.graphql.s3.service');

/** The shape `getObjectDetails` returns, mirroring the original's `Map<String, Object>`. */
export type ObjectDetails = Record<string, unknown>;

/**
 * Service class for interacting with MinIO for file storage operations.
 *
 * Every method the original declares as blocking is asynchronous here: the
 * MinIO client for Node returns promises, and `await` is the direct equivalent
 * of a blocking call on a request thread. Nothing else about the contract
 * changes — the same buckets are created on demand, and the same six exception
 * messages come back out.
 */
export class MinioService {
  constructor(private readonly minioClient: MinioClient) {}

  /**
   * Uploads an object to a specified bucket in MinIO.
   *
   * @param bucketName the name of the bucket
   * @param objectName the name of the object
   * @param filePath the path to the file to be uploaded
   * @throws MinioServiceException if an error occurs during the upload
   */
  uploadObject(bucketName: string, objectName: string, filePath: string): Promise<void>;
  /**
   * Overloaded method to upload an object to a specified bucket in MinIO using a byte array.
   *
   * @param bucketName the name of the bucket
   * @param objectName the name of the object
   * @param fileContent the byte array content of the file to be uploaded
   * @throws MinioServiceException if an error occurs during the upload
   */
  uploadObject(bucketName: string, objectName: string, fileContent: Uint8Array): Promise<void>;
  async uploadObject(
    bucketName: string,
    objectName: string,
    source: string | Uint8Array,
  ): Promise<void> {
    notEmpty('uploadObject.bucketName', bucketName);
    notEmpty('uploadObject.objectName', objectName);
    notEmpty('uploadObject.fileContent', source);

    if (typeof source === 'string') {
      Log.debugf(
        "Uploading object '%s' with filePath '%s' to bucket '%s'...",
        objectName,
        source,
        bucketName,
      );
    } else {
      Log.debugf(
        "Uploading object '%s' with byte array content to bucket '%s'...",
        objectName,
        bucketName,
      );
    }

    try {
      if (typeof source === 'string') {
        // Check if the file exists and is not empty
        const fileSize = statSync(source).size;
        if (fileSize === 0) {
          throw new Error('File is empty');
        }
      }

      // Verify if the bucket exists, if not create it
      const found = await this.minioClient.bucketExists(bucketName);

      if (!found) {
        await this.minioClient.makeBucket(bucketName);
        Log.debugf("Created bucket '%s'", bucketName);
      }

      // Upload the object to MinIO
      if (typeof source === 'string') {
        // `UploadObjectArgs` sends `application/octet-stream` unless a content
        // type is set; the client for Node would otherwise guess one from the
        // file's extension.
        await this.minioClient.fPutObject(bucketName, objectName, source, {
          'Content-Type': 'application/octet-stream',
        });
      } else {
        // `PutObjectArgs` sends `application/octet-stream` unless a content
        // type is set; the client for Node sends no header at all, and MinIO
        // then stores the object as `binary/octet-stream`.
        await this.minioClient.putObject(
          bucketName,
          objectName,
          Buffer.from(source),
          source.length,
          { 'Content-Type': 'application/octet-stream' },
        );
      }
      Log.debugf("Uploaded object '%s' to bucket '%s'", objectName, bucketName);
    } catch (error) {
      Log.error(error instanceof Error ? error.message : String(error), error);
      throw new MinioServiceException('Failed to upload object to MinIO', error);
    }
  }

  /**
   * Retrieves an object from a specified bucket in MinIO.
   *
   * @param bucketName the name of the bucket
   * @param objectName the name of the object
   * @returns a stream to read the object
   * @throws MinioServiceException if an error occurs during the retrieval
   */
  async getObject(bucketName: string, objectName: string): Promise<Readable> {
    notEmpty('getObject.bucketName', bucketName);
    notEmpty('getObject.objectName', objectName);

    try {
      return await this.minioClient.getObject(bucketName, objectName);
    } catch (error) {
      throw new MinioServiceException('Failed to retrieve object details from MinIO', error);
    }
  }

  /**
   * Retrieves an object from a specified bucket in MinIO and returns it as a Base64 encoded string.
   *
   * @param bucketName the name of the bucket
   * @param objectName the name of the object
   * @returns a Base64 encoded string of the object content
   * @throws MinioServiceException if an error occurs during the retrieval
   */
  async getObjectAsBase64(bucketName: string, objectName: string): Promise<string> {
    notEmpty('getObjectAsBase64.bucketName', bucketName);
    notEmpty('getObjectAsBase64.objectName', objectName);

    try {
      const stream = await this.minioClient.getObject(bucketName, objectName);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk as Buffer));
      }
      return Buffer.concat(chunks).toString('base64');
    } catch (error) {
      throw new MinioServiceException('Failed to retrieve object from MinIO', error);
    }
  }

  /**
   * Checks if a bucket exists in MinIO.
   *
   * @param bucketName the name of the bucket
   * @returns true if the bucket exists, false otherwise
   * @throws MinioServiceException if an error occurs during the check
   */
  async bucketExists(bucketName: string): Promise<boolean> {
    notEmpty('bucketExists.bucketName', bucketName);

    try {
      return await this.minioClient.bucketExists(bucketName);
    } catch (error) {
      throw new MinioServiceException('Failed to check bucket existence', error);
    }
  }

  /**
   * Creates a new bucket in MinIO.
   *
   * @param bucketName the name of the bucket
   * @returns true if the bucket was created successfully, false otherwise
   * @throws MinioServiceException if an error occurs during the creation
   */
  async makeBucket(bucketName: string): Promise<boolean> {
    notEmpty('makeBucket.bucketName', bucketName);

    try {
      await this.minioClient.makeBucket(bucketName);

      return await this.bucketExists(bucketName);
    } catch (error) {
      throw new MinioServiceException('Failed to create bucket', error);
    }
  }

  /**
   * Removes an object from a specified bucket in MinIO.
   *
   * @param bucketName the name of the bucket
   * @param objectName the name of the object
   * @throws MinioServiceException if an error occurs during the removal
   */
  async removeObject(bucketName: string, objectName: string): Promise<void> {
    notEmpty('removeObject.bucketName', bucketName);
    notEmpty('removeObject.objectName', objectName);

    try {
      await this.minioClient.removeObject(bucketName, objectName);
    } catch (error) {
      throw new MinioServiceException('Failed to remove object from MinIO', error);
    }
  }

  /**
   * Retrieves the details of an object from a specified bucket in MinIO.
   *
   * @param bucketName the name of the bucket
   * @param objectName the name of the object
   * @returns a map containing the details of the object
   * @throws MinioServiceException if an error occurs during the retrieval
   */
  async getObjectDetails(bucketName: string, objectName: string): Promise<ObjectDetails> {
    notEmpty('getObjectDetails.bucketName', bucketName);
    notEmpty('getObjectDetails.objectName', objectName);

    const objectDetails: ObjectDetails = {};

    try {
      // Obtain the object details from MinIO
      const stat = await this.minioClient.statObject(bucketName, objectName);
      // Aggiungi i dettagli dell'oggetto alla mappa
      objectDetails['bucketName'] = bucketName;
      objectDetails['objectName'] = objectName;
      objectDetails['size'] = stat.size;
      objectDetails['contentType'] = stat.metaData['content-type'] ?? null;
      objectDetails['lastModified'] = stat.lastModified;
      objectDetails['etag'] = stat.etag;

      // Build the presigned URL for the object
      const presignedUrl = await this.minioClient.presignedGetObject(bucketName, objectName);

      objectDetails['downloadUrl'] = presignedUrl;
    } catch (error) {
      throw new MinioServiceException('Failed to retrieve object details from MinIO', error);
    }

    return objectDetails;
  }
}
