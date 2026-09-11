/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { GraphQLException } from '../../../deps/graphql-exception.js';
import { decodeBase64 } from '../../../deps/java-lang.js';
import { MinioServiceException } from '../../../exception/minio-service-exception.js';
import type { MinioService } from '../../../s3/service/minio-service.js';
import { FileDTO } from '../../dto/file-dto.js';

/** `@GraphQLApi` `@ApplicationScoped`. */
export class FileGraphQL {
  constructor(private readonly minioService: MinioService) {}

  /** `@Query("getFile")` `@Description("Obtain a file from the S3 bucket")`. */
  async getFile(objectName: string, bucketName: string): Promise<FileDTO> {
    try {
      const fileDetails = await this.minioService.getObjectDetails(bucketName, objectName);
      const contentBase64 = await this.minioService.getObjectAsBase64(bucketName, objectName);

      return FileDTO.withOptionalFields(
        fileDetails['objectName'] as string,
        fileDetails['bucketName'] as string,
        fileDetails['downloadUrl'] as string,
        contentBase64,
        (fileDetails['contentType'] as string | null) ?? null,
        (fileDetails['size'] as number | null) ?? null,
        // `getObjectDetails` files the eTag under `etag`; reading it back as
        // `eTag` therefore always yields nothing. Preserved as-is: the original
        // reports a null eTag and its test asserts exactly that.
        (fileDetails['eTag'] as string | undefined) ?? null,
      );
    } catch (error) {
      if (error instanceof MinioServiceException) {
        throw new GraphQLException(error.message);
      }
      throw error;
    }
  }

  /** `@Mutation("uploadFile")` `@Description("Load a file into the S3 bucket")`. */
  async uploadFile(
    objectName: string,
    bucketName: string,
    contentBase64: string,
  ): Promise<FileDTO> {
    const content = decodeBase64(contentBase64);
    await this.minioService.uploadObject(bucketName, objectName, content);

    const fileDetails = await this.minioService.getObjectDetails(bucketName, objectName);

    return FileDTO.withMandatoryFields(
      fileDetails['objectName'] as string,
      fileDetails['bucketName'] as string,
      fileDetails['downloadUrl'] as string,
    );
  }

  /** `@Mutation("deleteFile")` `@Description("Elimina un file dal bucket S3")`. */
  async deleteFile(objectName: string, bucketName: string): Promise<boolean> {
    await this.minioService.removeObject(bucketName, objectName);
    return true;
  }
}
