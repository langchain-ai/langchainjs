type AssistantTool =
  | {
      /**
       * The type of tool being defined.
       */
      type: string;
    }
  | {
      /**
       * The type of tool being defined.
       */
      type: string;
      /**
       * The function definition.
       */
      function: {
        /**
         * A description of what the function does, used by the model to choose when and how to call the function.
         */
        description: string;
        /**
         * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
         */
        name: string;
        /**
         * The parameters the functions accepts, described as a JSON Schema object.
         * @link https://json-schema.org/understanding-json-schema
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: Record<string, unknown>;
      };
    };

export interface Assistant {
  /**
   * The identifier, which can be referenced in API endpoints.
   */
  id: string;
  /**
   * The object type, which is always `assistant`.
   */
  object: "assistant";
  /**
   * The Unix timestamp (in seconds) for when the assistant was created.
   */
  created_at: number;
  /**
   * The name of the assistant. The maximum length is 256 characters.
   */
  name: string | null;
  /**
   * ID of the model to use.
   */
  model: string;
  /**
   * The description of the assistant. The maximum length is 512 characters.
   */
  description?: string;
  /**
   * The system instructions that the assistant uses. The maximum length is 32768 characters.
   */
  instructions?: string;
  /**
   * A list of tool enabled on the assistant. There can be a maximum of 128 tools per assistant. Tools can be of types `code_interpreter`, `retrieval`, or `function`.
   */
  tools?: AssistantTool[];
  /**
   * A list of file IDs attached to this assistant. There can be a maximum of 20 files attached to the assistant. Files are ordered by their creation date in ascending order.
   */
  fileIds?: string[];
  /**
   * Set of 16 key-value pairs that can be attached to an object. This can be useful for storing additional information about the object in a structured format. Keys can be a maximum of 64 characters long and values can be a maximum of 512 characters long.
   */
  metadata?: Record<string, unknown>;
}

export interface AssistantInput
  extends Omit<Assistant, "id" | "object" | "created_at"> {}

export interface ListAssistantInputs {
  /**
   * A limit on the number of objects to be returned. Limit can range between 1 and 100.
   * @default 20
   */
  limit: number;
  /**
   * Sort order by the `created_at` timestamp of the objects. `asc` for ascending order and `desc` for descending order.
   * @default desc
   */
  order: "asc" | "desc";
  /**
   * A cursor for use in pagination. `after` is an object ID that defines your place in the list.
   * For instance, if you make a list request and receive 100 objects, ending with obj_foo, your subsequent call can include after=obj_foo in order to fetch the next page of the list.
   */
  after?: string;
  /**
   * A cursor for use in pagination. `before` is an object ID that defines your place in the list.
   * For instance, if you make a list request and receive 100 objects, ending with obj_foo, your subsequent call can include before=obj_foo in order to fetch the previous page of the list.
   */
  before?: string;
}

export interface AssistantFile {
  /**
   * The identifier, which can be referenced in API endpoints.
   */
  id: string;
  /**
   * The object type, which is always `assistant.file`.
   */
  object: "assistant.file";
  /**
   * The Unix timestamp (in seconds) for when the assistant file was created.
   */
  created_at: number;
  /**
   * The assistant ID that the file is attached to.
   */
  assistant_id: string;
}

export interface CreateAssistantFileInputs {
  /**
   * A File ID (with `purpose: "assistants"`) that the assistant should use. Useful for tools like `retrieval` and `code_interpreter` that can access files.
   */
  file_id: string;
}
