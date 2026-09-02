/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { FileDTO } from '../../../src/ws/dto/file-dto.js';

describe('FileDTOTest', () => {
  it('withMandatoryFieldsCreatesFileDTO', () => {
    const fileDTO = FileDTO.withMandatoryFields('test-object', 'test-bucket', 'https://example.com');

    expect(fileDTO.objectName).toBe('test-object');
    expect(fileDTO.bucketName).toBe('test-bucket');
    expect(fileDTO.url).toBe('https://example.com');
    expect(fileDTO.content).toBeNull();
    expect(fileDTO.contentType).toBeNull();
    expect(fileDTO.size).toBeNull();
    expect(fileDTO.eTag).toBeNull();
  });

  it('withOptionalFieldsCreatesFileDTO', () => {
    const fileDTO = FileDTO.withOptionalFields(
      'test-object',
      'test-bucket',
      'https://example.com',
      'test content',
      'text/plain',
      123,
      'etag123',
    );

    expect(fileDTO.objectName).toBe('test-object');
    expect(fileDTO.bucketName).toBe('test-bucket');
    expect(fileDTO.url).toBe('https://example.com');
    expect(fileDTO.content).toBe('test content');
    expect(fileDTO.contentType).toBe('text/plain');
    expect(fileDTO.size).toBe(123);
    expect(fileDTO.eTag).toBe('etag123');
  });

  it('withOptionalFieldsHandlesNullValues', () => {
    const fileDTO = FileDTO.withOptionalFields(
      'test-object',
      'test-bucket',
      'https://example.com',
      null,
      null,
      null,
      null,
    );

    expect(fileDTO.objectName).toBe('test-object');
    expect(fileDTO.bucketName).toBe('test-bucket');
    expect(fileDTO.url).toBe('https://example.com');
    expect(fileDTO.content).toBeNull();
    expect(fileDTO.contentType).toBeNull();
    expect(fileDTO.size).toBeNull();
    expect(fileDTO.eTag).toBeNull();
  });
});
