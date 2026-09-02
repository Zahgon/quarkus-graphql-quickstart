/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { FastifyInstance } from 'fastify';
// Type-only: brings @fastify/multipart's `request.parts()` augmentation into scope.
import type {} from '@fastify/multipart';
import { createWriteStream } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { Response, WebApplicationException } from '../../../../../deps/jaxrs.js';
import type { MinioService } from '../../../../../s3/service/minio-service.js';
import { sendResponse } from '../../../binding.js';

/**
 * `org.jboss.resteasy.reactive.multipart.FileUpload` — the handle RESTEasy
 * gives a resource for one part of a multipart request. Only `filePath()` is
 * used, and only its `toString()` at that.
 */
export interface FileUpload {
  filePath(): string;
}

/** `@Path("/s3/files")`. */
export class FileResource {
  constructor(private readonly minioService: MinioService) {}

  async uploadFile(
    bucketName: string,
    objectName: string,
    fileUpload: FileUpload,
  ): Promise<Response> {
    try {
      await this.minioService.uploadObject(bucketName, objectName, fileUpload.filePath());

      const objectDetails = await this.minioService.getObjectDetails(bucketName, objectName);
      return Response.ok(objectDetails).build();
    } catch (error) {
      throw new WebApplicationException(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async downloadFile(bucketName: string, objectName: string): Promise<Response> {
    // Scarica il file da MinIO
    const fileStream = await this.minioService.getObject(bucketName, objectName);
    return Response.ok(fileStream)
      .header('Content-Disposition', `attachment; filename="${objectName}"`)
      .build();
  }
}

export function registerFileResource(app: FastifyInstance, resource: FileResource): void {
  app.post('/s3/files/upload', async (request, reply) => {
    let bucketName = '';
    let objectName = '';
    let uploadedPath: string | null = null;

    // RESTEasy spools each file part to a temporary file and exposes its path;
    // @fastify/multipart streams the parts, so the same spooling happens here.
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const directory = await mkdtemp(join(tmpdir(), 'resteasy-upload-'));
        const target = join(directory, part.filename === '' ? 'upload' : part.filename);
        await pipeline(part.file, createWriteStream(target));
        uploadedPath = target;
      } else if (part.fieldname === 'bucketName') {
        bucketName = String(part.value);
      } else if (part.fieldname === 'objectName') {
        objectName = String(part.value);
      }
    }

    const path = uploadedPath;
    const fileUpload: FileUpload = { filePath: (): string => path ?? '' };
    return sendResponse(reply, await resource.uploadFile(bucketName, objectName, fileUpload));
  });

  app.get<{ Params: { bucketName: string; objectName: string } }>(
    '/s3/files/download/:bucketName/:objectName',
    async (request, reply) => {
      const response = await resource.downloadFile(
        request.params.bucketName,
        request.params.objectName,
      );
      return sendResponse(reply.type('application/octet-stream'), response);
    },
  );
}
