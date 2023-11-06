import {
  Assistant,
  AssistantFile,
  AssistantInput,
  CreateAssistantFileInputs,
  ListAssistantInputs,
} from "./schema.js";

export class OpenAIAssistant {
  constructor() {}

  async create(_input: AssistantInput): Promise<Assistant> {
    throw new Error("Not implemented");
  }

  async retrieve(_id: string): Promise<Assistant> {
    throw new Error("Not implemented");
  }

  async modify(
    _id: string,
    _assistantUpdates: Partial<AssistantInput>
  ): Promise<Assistant> {
    throw new Error("Not implemented");
  }

  async delete(_id: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async list(_input: ListAssistantInputs): Promise<Assistant[]> {
    throw new Error("Not implemented");
  }

  async createAssistantFile(
    _id: string,
    _input: CreateAssistantFileInputs
  ): Promise<AssistantFile> {
    throw new Error("Not implemented");
  }

  /**
   * Retrieves an AssistantFile.
   * @param _id {string} The ID of the assistant who the file belongs to.
   * @param _fileId {string} The ID of the file we're getting.
   */
  async retrieveAssistantFile(
    _id: string,
    _fileId: string
  ): Promise<AssistantFile> {
    throw new Error("Not implemented");
  }

  /**
   * Delete an assistant file.
   * @param _id {string} The ID of the assistant who the file belongs to.
   * @param _fileId {string} The ID of the file to delete.
   */
  async deleteAssistantFile(
    _id: string,
    _fileId: string
  ): Promise<{
    id: string;
    object: "assistant.file.deleted";
    deleted: true;
  }> {
    throw new Error("Not implemented");
  }

  async listFiles() {}
}
