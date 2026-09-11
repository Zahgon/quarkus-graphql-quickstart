/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { describe, expect, it } from 'vitest';

import { graphql, path } from '../../../support/rest.js';

/** `@QuarkusTest` `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)`. */
describe('EditorGraphQLIntegrationTest', () => {
  it('allEditors_returnsAllEditors', async () => {
    const response = await graphql('{ allEditors { id name } }');

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.allEditors')).not.toBeNull();
  });

  it('getEditor_returnsEditorById', async () => {
    const editorId = 5; // Assumes an editor with ID 5 exists

    const response = await graphql(
      `query getEditor { editor(editorId: ${String(editorId)}) { id name } }`,
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.editor.id')).toBe(editorId);
    expect(path(response, 'data.editor.name')).not.toBeNull();
  });

  it('createEditor_createsNewEditor', async () => {
    const editorName = 'New Editor';

    const response = await graphql(
      `mutation { createEditor(editor: { name: "${editorName}" }) { id name } }`,
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.createEditor.id')).not.toBeNull();
    expect(path(response, 'data.createEditor.name')).toBe(editorName);
  });

  it('updateEditor_updatesExistingEditor', async () => {
    const editorId = 5; // Assumes an editor with ID 1 exists
    const updatedName = 'Updated Editor';

    const response = await graphql(
      `mutation updateEditor { updateEditor(editorId: ${String(editorId)} , ` +
        `editorData: { name: "${updatedName}" }) { id name } }`,
    );

    expect(response.statusCode).toBe(200);
    expect(path(response, 'data.updateEditor.id')).toBe(editorId);
    expect(path(response, 'data.updateEditor.name')).toBe(updatedName);
  });
});
