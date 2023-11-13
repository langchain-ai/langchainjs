import { OpenAI as OpenAIClient } from "openai";
import fs from "node:fs";
import { RequestOptions } from "openai/core.mjs";

export type OpenAIFilesCreate = {
  file: fs.ReadStream;
  purpose: "assistants" | "fine-tune";
};

export class OpenAIFiles {
  /**
   * Upload file
   * Upload a file that can be used across various endpoints. The size of all the files uploaded by one organization can be up to 100 GB.
   *
   * The size of individual files can be a maximum of 512 MB. See the Assistants Tools guide to learn more about the types of files supported. The Fine-tuning API only supports .jsonl files.
   *
   * @link https://platform.openai.com/docs/api-reference/files/create
   * @param file: fs.ReadStream
   * @param purpose: "assistants" | "fine-tune"
   * @returns
   */
  static async createFile({ file, purpose }: OpenAIFilesCreate) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.create({
      file,
      purpose,
    });
  }

  /**
   * Delete a file.
   * @link https://platform.openai.com/docs/api-reference/files/delete
   *
   * @param fileId: string
   * @returns
   */
  static async deleteFile({ fileId }: { fileId: string }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.del(fileId);
  }

  /**
   * List files
   * Returns a list of files that belong to the user's organization.
   * @link https://platform.openai.com/docs/api-reference/files/list
   * @param query: OpenAIClient.Files.FileListParams | undefined
   * @param options: RequestOptions | undefined
   * @returns
   */
  static async listFiles(props?: {
    query?: OpenAIClient.Files.FileListParams;
    options?: RequestOptions;
  }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.list(props?.query, props?.options);
  }

  /**
   * Retrieve file
   * Returns information about a specific file.
   * @link https://platform.openai.com/docs/api-reference/files/retrieve
   * @param fileId: string
   * @returns
   */
  static async retrieveFile({ fileId }: { fileId: string }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.retrieve(fileId);
  }

  /**
   * Retrieve file content
   * Returns the contents of the specified file.
   *
   * Note: You can't retrieve the contents of a file that was uploaded with the "purpose": "assistants" API.
   *
   * @link https://platform.openai.com/docs/api-reference/files/retrieve-contents
   * @param fileId: string
   * @returns
   */
  static async retrieveFileContent({ fileId }: { fileId: string }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.retrieveContent(fileId);
  }
}
