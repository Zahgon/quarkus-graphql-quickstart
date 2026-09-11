/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * `@Description("Rappresenta un file con i dettagli")`
 *
 * A Java record: immutable, with two named factories. The TypeScript
 * equivalent is a class with `readonly` fields and a private constructor.
 */
export class FileDTO {
  private constructor(
    readonly objectName: string | null,
    readonly bucketName: string | null,
    readonly url: string | null,
    readonly content: string | null,
    readonly contentType: string | null,
    readonly size: number | null,
    readonly eTag: string | null,
  ) {}

  static withMandatoryFields(
    objectName: string | null,
    bucketName: string | null,
    url: string | null,
  ): FileDTO {
    return new FileDTO(objectName, bucketName, url, null, null, null, null);
  }

  static withOptionalFields(
    objectName: string | null,
    bucketName: string | null,
    url: string | null,
    content: string | null,
    contentType: string | null,
    size: number | null,
    eTag: string | null,
  ): FileDTO {
    return new FileDTO(objectName, bucketName, url, content, contentType, size, eTag);
  }
}
