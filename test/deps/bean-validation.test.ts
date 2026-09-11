/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { ConstraintViolationException, notEmpty } from '../../src/deps/bean-validation.js';
import { minioService } from '../support/application.js';

/**
 * A test the original does not have: Hibernate Validator applied the parameter
 * constraints for it. The port declares the same ones, and the message text is
 * user-visible — a GraphQL caller sees it as `errors[0].message`.
 */
describe('BeanValidationTest', () => {
  it('notEmpty_acceptsANonEmptyValue', () => {
    expect(() => {
      notEmpty('books.after', 'MA==');
    }).not.toThrow();
    expect(() => {
      notEmpty('uploadObject.fileContent', Buffer.from('x'));
    }).not.toThrow();
  });

  it('notEmpty_rejectsAnEmptyValue', () => {
    expect(() => {
      notEmpty('books.after', '');
    }).toThrow(new ConstraintViolationException('validation failed: books.after must not be empty'));
    expect(() => {
      notEmpty('uploadObject.fileContent', Buffer.alloc(0));
    }).toThrow('validation failed: uploadObject.fileContent must not be empty');
  });

  it('notEmpty_rejectsAnAbsentValue', () => {
    expect(() => {
      notEmpty('books.after', null);
    }).toThrow('validation failed: books.after must not be null');
    expect(() => {
      notEmpty('books.after', undefined);
    }).toThrow('validation failed: books.after must not be null');
  });

  it('minioService_validatesEveryConstrainedParameter', async () => {
    const service = await minioService();

    await expect(service.uploadObject('', 'o', 'p')).rejects.toThrow(
      'validation failed: uploadObject.bucketName must not be empty',
    );
    await expect(service.uploadObject('b', '', 'p')).rejects.toThrow(
      'validation failed: uploadObject.objectName must not be empty',
    );
    await expect(service.uploadObject('b', 'o', '')).rejects.toThrow(
      'validation failed: uploadObject.fileContent must not be empty',
    );
    await expect(service.getObject('', 'o')).rejects.toThrow(
      'validation failed: getObject.bucketName must not be empty',
    );
    await expect(service.getObject('b', '')).rejects.toThrow(
      'validation failed: getObject.objectName must not be empty',
    );
    await expect(service.getObjectAsBase64('', 'o')).rejects.toThrow(
      'validation failed: getObjectAsBase64.bucketName must not be empty',
    );
    await expect(service.getObjectAsBase64('b', '')).rejects.toThrow(
      'validation failed: getObjectAsBase64.objectName must not be empty',
    );
    await expect(service.bucketExists('')).rejects.toThrow(
      'validation failed: bucketExists.bucketName must not be empty',
    );
    await expect(service.makeBucket('')).rejects.toThrow(
      'validation failed: makeBucket.bucketName must not be empty',
    );
    await expect(service.removeObject('', 'o')).rejects.toThrow(
      'validation failed: removeObject.bucketName must not be empty',
    );
    await expect(service.removeObject('b', '')).rejects.toThrow(
      'validation failed: removeObject.objectName must not be empty',
    );
    await expect(service.getObjectDetails('', 'o')).rejects.toThrow(
      'validation failed: getObjectDetails.bucketName must not be empty',
    );
    await expect(service.getObjectDetails('b', '')).rejects.toThrow(
      'validation failed: getObjectDetails.objectName must not be empty',
    );
  });
});
