import { OpenAI as OpenAIClient } from "openai";
import fs from "node:fs";
import { Serializable } from "../../load/serializable.js";

export type OpenAIFilesCreate = {
  file: fs.ReadStream;
  purpose: "assistants" | "fine-tune";
};

export class OpenAIFiles extends Serializable {
  lc_namespace = ["langchain", "experimental", "open_ai_files"];

  /**
   * Upload file
   * Upload a file that can be used across various endpoints. The size of all the files uploaded by one organization can be up to 100 GB.
   *
   * The size of individual files can be a maximum of 512 MB. See the Assistants Tools guide to learn more about the types of files supported. The Fine-tuning API only supports .jsonl files.
   *
   * @link {https://platform.openai.com/docs/api-reference/files/create}
   * @param {fs.ReadStream} file
   * @param {"assistants" | "fine-tune"} purpose
   * @returns {Promise<OpenAIClient.Files.FileObject>}
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
   * @link {https://platform.openai.com/docs/api-reference/files/delete}
   *
   * @param {string} fileId
   * @returns {Promise<OpenAIClient.Files.FileDeleted>}
   */
  static async deleteFile({ fileId }: { fileId: string }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.del(fileId);
  }

  /**
   * List files
   * Returns a list of files that belong to the user's organization.
   * @link {https://platform.openai.com/docs/api-reference/files/list}
   * @param {OpenAIClient.Files.FileListParams | undefined} query
   * @param {OpenAIClient.RequestOptions | undefined} options
   * @returns {Promise<OpenAIClient.Files.FileObjectsPage>}
   */
  static async listFiles(props?: {
    query?: OpenAIClient.Files.FileListParams;
    options?: OpenAIClient.RequestOptions;
  }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.list(props?.query, props?.options);
  }

  /**
   * Retrieve file
   * Returns information about a specific file.
   * @link {https://platform.openai.com/docs/api-reference/files/retrieve}
   * @param {string} fileId
   * @returns {Promise<OpenAIClient.Files.FileObject>}
   */
  static async retrieveFile({ fileId }: { fileId: string }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.retrieve(fileId);
  }

  /**
   * Retrieve file content
   * Returns the contents of the specified file.
   *
   * @note You can't retrieve the contents of a file that was uploaded with the "purpose": "assistants" API.
   *
   * @link {https://platform.openai.com/docs/api-reference/files/retrieve-contents}
   * @param {string} fileId
   * @returns {Promise<string>}
   */
  static async retrieveFileContent({ fileId }: { fileId: string }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.retrieveContent(fileId);
  }
}
