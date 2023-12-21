import { OpenAIClient, type ClientOptions } from "@langchain/openai";
import { Serializable } from "../../load/serializable.js";

export type OpenAIFilesInput = {
  client?: OpenAIClient;
  clientOptions?: ClientOptions;
};

export class OpenAIFiles extends Serializable {
  lc_namespace = ["langchain", "experimental"];

  private oaiClient: OpenAIClient;

  constructor(fields?: OpenAIFilesInput) {
    super(fields);
    this.oaiClient = fields?.client ?? new OpenAIClient(fields?.clientOptions);
  }

  /**
   * Upload file
   * Upload a file that can be used across various endpoints. The size of all the files uploaded by one organization can be up to 100 GB.
   *
   * @note The size of individual files can be a maximum of 512 MB. See the Assistants Tools guide to learn more about the types of files supported. The Fine-tuning API only supports .jsonl files.
   *
   * @link {https://platform.openai.com/docs/api-reference/files/create}
   * @param {OpenAIClient.FileCreateParams['file']} file
   * @param {OpenAIClient.FileCreateParams['purpose']} purpose
   * @param {OpenAIClient.RequestOptions | undefined} options
   * @returns {Promise<OpenAIClient.Files.FileObject>}
   */
  async createFile({
    file,
    purpose,
    options,
  }: OpenAIClient.FileCreateParams & {
    options?: OpenAIClient.RequestOptions;
  }) {
    return this.oaiClient.files.create({ file, purpose }, options);
  }

  /**
   * Delete a file.
   *
   * @link {https://platform.openai.com/docs/api-reference/files/delete}
   * @param {string} fileId
   * @param {OpenAIClient.RequestOptions | undefined} options
   * @returns {Promise<OpenAIClient.Files.FileDeleted>}
   */
  async deleteFile({
    fileId,
    options,
  }: {
    fileId: string;
    options?: OpenAIClient.RequestOptions;
  }) {
    return this.oaiClient.files.del(fileId, options);
  }

  /**
   * List files
   * Returns a list of files that belong to the user's organization.
   *
   * @link {https://platform.openai.com/docs/api-reference/files/list}
   * @param {OpenAIClient.Files.FileListParams | undefined} query
   * @param {OpenAIClient.RequestOptions | undefined} options
   * @returns {Promise<OpenAIClient.Files.FileObjectsPage>}
   */
  async listFiles(props?: {
    query?: OpenAIClient.Files.FileListParams;
    options?: OpenAIClient.RequestOptions;
  }) {
    return this.oaiClient.files.list(props?.query, props?.options);
  }

  /**
   * Retrieve file
   * Returns information about a specific file.
   *
   * @link {https://platform.openai.com/docs/api-reference/files/retrieve}
   * @param {string} fileId
   * @param {OpenAIClient.RequestOptions | undefined} options
   * @returns {Promise<OpenAIClient.Files.FileObject>}
   */
  async retrieveFile({
    fileId,
    options,
  }: {
    fileId: string;
    options?: OpenAIClient.RequestOptions;
  }) {
    return this.oaiClient.files.retrieve(fileId, options);
  }

  /**
   * Retrieve file content
   * Returns the contents of the specified file.
   *
   * @note You can't retrieve the contents of a file that was uploaded with the "purpose": "assistants" API.
   *
   * @link {https://platform.openai.com/docs/api-reference/files/retrieve-contents}
   * @param {string} fileId
   * @param {OpenAIClient.RequestOptions | undefined} options
   * @returns {Promise<string>}
   */
  async retrieveFileContent({
    fileId,
    options,
  }: {
    fileId: string;
    options?: OpenAIClient.RequestOptions;
  }) {
    return this.oaiClient.files.retrieveContent(fileId, options);
  }
}
