/*
 * Copyright (c) 2025 Antonio Musarra's Blog.
 * SPDX-License-Identifier: MIT
 */
import { NotFoundException } from '../../../deps/jaxrs.js';
import { Editor } from '../../../orm/panache/entity/editor.js';
import { transactional } from '../../../orm/panache/session.js';

/** `@GraphQLApi` `@ApplicationScoped`. */
export class EditorGraphQL {
  /** `@Query` `@Description("Get all editors")`. */
  async allEditors(): Promise<Editor[]> {
    return await Editor.listAllEditors();
  }

  /** `@Query` `@Description("Get an editor by id")`. */
  async getEditor(id: number | null): Promise<Editor | null> {
    return await Editor.findEditorById(id);
  }

  /** `@Mutation` `@Description("Create a new editor")` `@Transactional`. */
  async createEditor(editor: Editor): Promise<Editor> {
    return await transactional(async () => {
      // The editor is persisted automatically by Panache
      // because it is a Panache entity.
      // Extend this method to handle the detached entity as needed.
      await editor.persist();
      return editor;
    });
  }

  /** `@Mutation` `@Description("Delete an editor by id")` `@Transactional`. */
  async updateEditor(id: number, editorData: Editor): Promise<Editor> {
    return await transactional(async () => {
      const editor = await this.getEditor(id);
      if (editor === null) {
        throw new NotFoundException('Editor not found');
      }
      editor.name = editorData.name;
      await editor.persist();
      return editor;
    });
  }
}
