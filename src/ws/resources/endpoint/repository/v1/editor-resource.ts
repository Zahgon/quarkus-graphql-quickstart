/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import type { FastifyInstance } from 'fastify';

import { NotFoundException, Response, Status } from '../../../../../deps/jaxrs.js';
import { Editor } from '../../../../../orm/panache/entity/editor.js';
import { fromJson } from '../../../../../orm/panache/json.js';
import { transactional } from '../../../../../orm/panache/session.js';
import { sendResponse } from '../../../binding.js';

/** `@Path("/editors")`, producing and consuming `application/json`. */
export class EditorResource {
  async list(): Promise<Editor[]> {
    return await Editor.listAllEditors();
  }

  async get(id: number): Promise<Editor> {
    const editor = await Editor.findEditorById(id);
    if (editor === null) {
      throw new NotFoundException();
    }
    return editor;
  }

  async create(editor: Editor): Promise<Response> {
    return await transactional(async () => {
      await editor.persist();
      return Response.created(`/editors/${String(editor.id)}`).build();
    });
  }

  async update(id: number, editor: Editor): Promise<Editor> {
    return await transactional(async () => {
      const existingEditor = await Editor.findEditorById(id);
      if (existingEditor === null) {
        throw new NotFoundException();
      }
      existingEditor.name = editor.name;
      await existingEditor.persist();
      return existingEditor;
    });
  }

  async delete(id: number): Promise<void> {
    await transactional(async () => {
      const editor = await Editor.findEditorById(id);
      if (editor === null) {
        throw new NotFoundException();
      }
      await editor.delete();
    });
  }
}

export function registerEditorResource(app: FastifyInstance, resource: EditorResource): void {
  app.get('/editors', async (_request, reply) => reply.send(await resource.list()));

  app.get<{ Params: { id: string } }>('/editors/:id', async (request, reply) =>
    reply.send(await resource.get(Number(request.params.id))),
  );

  app.post('/editors', async (request, reply) => {
    const response = await resource.create(fromJson(Editor, request.body));
    return sendResponse(reply, response);
  });

  app.put<{ Params: { id: string } }>('/editors/:id', async (request, reply) =>
    reply.send(await resource.update(Number(request.params.id), fromJson(Editor, request.body))),
  );

  app.delete<{ Params: { id: string } }>('/editors/:id', async (request, reply) => {
    await resource.delete(Number(request.params.id));
    return reply.code(Status.NO_CONTENT).send();
  });
}
