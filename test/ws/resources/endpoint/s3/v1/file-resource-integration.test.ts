/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { get, multiPart, path } from '../../../../../support/rest.js';

async function createTempFile(prefix: string, suffix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const file = join(directory, `${prefix}${suffix}`);
  await writeFile(file, '');
  return file;
}

describe('FileResourceIntegrationTest', () => {
  it('uploadNonExistentFile', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const filePath = await createTempFile('empty-test-file', '.txt');

    const response = await multiPart('/api/s3/files/upload', [
      { name: 'bucketName', value: bucketName },
      { name: 'objectName', value: objectName },
      {
        name: 'objectFile',
        file: new Blob([await readFile(filePath)], { type: 'application/octet-stream' }),
        filename: 'empty-test-file.txt',
      },
    ]);

    expect(response.statusCode).toBe(500);
    expect(path(response, 'error')).toBe('Failed to upload object to MinIO');
  });

  it('uploadFileSuccessfully', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';
    const filePath = await createTempFile('test-file', '.txt');
    await writeFile(filePath, 'test content');

    const response = await multiPart('/api/s3/files/upload', [
      { name: 'bucketName', value: bucketName },
      { name: 'objectName', value: objectName },
      {
        name: 'objectFile',
        file: new Blob([await readFile(filePath)], { type: 'application/octet-stream' }),
        filename: 'test-file.txt',
      },
    ]);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'objectName')).toBe('test-object');

    await rm(filePath, { force: true });
  });

  it('downloadFileSuccessfully', async () => {
    const bucketName = 'test-bucket';
    const objectName = 'test-object';

    const response = await get(
      `/api/s3/files/download/${bucketName}/${objectName}`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="${objectName}"`,
    );
    expect(response.text).toBe('test content');
  });
});
