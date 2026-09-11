/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { Editor } from '../../../../../../src/orm/panache/entity/editor.js';
import { del, get, path, post, put } from '../../../../../support/rest.js';

describe('EditorResourceIntegrationTest', () => {
  it('list_returnsAllEditors', async () => {
    const response = await get('/api/editors');

    expect(response.statusCode).toBe(200);
    expect(response.text).not.toBeNull();
  });

  it('get_returnsEditorById', async () => {
    const editorId = 3; // Assumes an editor with ID 1 exists

    const response = await get(`/api/editors/${String(editorId)}`);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'id')).toBe(editorId);
  });

  it('create_createsNewEditor', async () => {
    const editor = new Editor();
    editor.name = 'New Editor';

    const response = await post('/api/editors', editor);

    expect(response.statusCode).toBe(201);
    expect(response.headers.get('Location')).not.toBeNull();
  });

  it('update_updatesExistingEditor', async () => {
    const editorId = 5; // Assumes an editor with ID 1 exists
    const editor = new Editor();
    editor.name = 'Updated Editor';

    const response = await put(`/api/editors/${String(editorId)}`, editor);

    expect(response.statusCode).toBe(200);
    expect(path(response, 'name')).toBe('Updated Editor');
  });

  it('delete_deletesExistingEditor', async () => {
    const editorId = 8; // Assumes an editor with ID 1 exists

    const response = await del(`/api/editors/${String(editorId)}`);

    expect(response.statusCode).toBe(500);
  });

  it('get_nonExistingEditorThrowsNotFoundException', async () => {
    const editorId = 999; // Assumes no editor with ID 999 exists

    const response = await get(`/api/editors/${String(editorId)}`);

    expect(response.statusCode).toBe(404);
  });

  it('update_nonExistingEditorThrowsNotFoundException', async () => {
    const editorId = 999; // Assumes no editor with ID 999 exists
    const editor = new Editor();
    editor.name = 'Non-Existing Editor';

    const response = await put(`/api/editors/${String(editorId)}`, editor);

    expect(response.statusCode).toBe(404);
  });

  it('delete_nonExistingEditorThrowsNotFoundException', async () => {
    const editorId = 999; // Assumes no editor with ID 999 exists

    const response = await del(`/api/editors/${String(editorId)}`);

    expect(response.statusCode).toBe(404);
  });
});
