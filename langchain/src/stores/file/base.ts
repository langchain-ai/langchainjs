import { Serializable } from "@langchain/core/load/serializable";

/**
 * Base class for all file stores. All file stores should extend this
 * class.
 */
export abstract class BaseFileStore extends Serializable {
  abstract readFile(path: string): Promise<string>;

  abstract writeFile(path: string, contents: string): Promise<void>;
}
