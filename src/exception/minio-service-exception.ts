/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */

/**
 * Custom exception class for handling MinIO service errors.
 */
export class MinioServiceException extends Error {
  /**
   * Constructs a new MinioServiceException with the specified detail message and cause.
   *
   * @param message the detail message
   * @param cause the cause of the exception
   */
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'MinioServiceException';
  }
}
