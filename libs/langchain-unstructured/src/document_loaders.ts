import { SDKOptions, UnstructuredClient } from "unstructured-client";
import * as fs from "node:fs";
import * as path from "node:path";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Document, DocumentInterface } from "@langchain/core/documents";
import {
  PartitionParameters,
  Strategy as StrategyEnum,
} from "unstructured-client/sdk/models/shared";

/**
 * The strategy to use for partitioning PDF/image.
 * Options are:
 * - "fast"
 * - "hi_res"
 * - "auto"
 * - "ocr_only"
 * @default "auto"
 */
export type UnstructuredLoaderStrategy =
  | "fast"
  | "hi_res"
  | "auto"
  | "ocr_only";

/**
 * Options for the UnstructuredMemoryLoader.
 */
export type UnstructuredMemoryLoaderOptions =
  | {
      /**
       * Buffer can not be defined if passing paths to files.
       */
      buffer?: never;
      /**
       * The path to the file, or an array of paths to multiple files.
       */
      filePath: string | string[];
      fileName?: never;
    }
  | {
      /**
       * The buffer containing the file content.
       */
      buffer?: Buffer;
      /**
       * The name of the file.
       */
      fileName: string;
      filePath?: never;
    };

export interface UnstructuredLoaderOptions
  extends SDKOptions,
    Omit<PartitionParameters, "files" | "strategy"> {
  partitionViaApi?: boolean;
  postProcessors?: ((str: string) => string)[];
  // SDK parameters
  apiKey?: string;
  client?: UnstructuredClient;
  strategy?: UnstructuredLoaderStrategy;
  /**
   * The Unstructured SDK has logs they call `console.info` to
   * log at request time. Passing `true` will log these messages.
   * The default of `false` will overwrite the `console.info` function
   * so that it does not log.
   * @default false
   */
  enableLogs?: boolean;
}

/**
 * Represents an element returned by the Unstructured API. It has
 * properties for the element type, text content, and metadata.
 */
type Element = {
  type: string;
  text: string;
  // this is purposefully loosely typed
  metadata: {
    [key: string]: unknown;
  };
};

const _DEFAULT_URL = "https://api.unstructuredapp.io/general/v0/general";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnstructuredDocumentMetadata = Record<string, any> & {
  category: string;
};

/**
 * Unstructured document loader interface.
 *
 * Partition and load files using either the `unstructured-client` sdk and the
 * Unstructured API or locally using the `unstructured` library.
 *
 * API:
 * This package is configured to work with the Unstructured API by default.
 * To use the Unstructured API, set
 * `partitionViaApi: true` and define `apiKey`. If you are running the unstructured
 * API locally, you can change the API rule by defining `url` when you initialize the
 * loader. The hosted Unstructured API requires an API key. See the links below to
 * learn more about our API offerings and get an API key.
 *
 * Local:
 * To partition files locally, you must have the `unstructured` package installed.
 * You can install it with `pip install unstructured`.
 * By default the file loader uses the Unstructured `partition` function and will
 * automatically detect the file type.
 *
 * In addition to document specific partition parameters, Unstructured has a rich set
 * of "chunking" parameters for post-processing elements into more useful text segments
 * for uses cases such as Retrieval Augmented Generation (RAG). You can pass additional
 * Unstructured kwargs to the loader to configure different unstructured settings.
 *
 * Setup:
 * Install the package:
 * ```bash
 * npm install @langchain/unstructured
 * ```
 * Set the API key in your environment:
 * ```bash
 * export UNSTRUCTURED_API_KEY="your-api-key"
 * ```
 *
 * Instantiate:
 * ```typescript
 * import { UnstructuredLoader } from "@langchain/unstructured";
 *
 * const loader = new UnstructuredLoader({
 *   filePath: ["example.pdf", "fake.pdf"],
 *   apiKey: process.env.UNSTRUCTURED_API_KEY,
 *   partitionViaApi: true,
 *   chunkingStrategy: "by_title",
 *   strategy: "fast",
 * });
 *     ```
 *
 * Load:
 * ```typescript
 * const docs = await loader.load();
 *
 * console.log(docs[0].pageContent.slice(0, 100));
 * console.log(docs[0].metadata);
 * ```
 *
 * References
 * ----------
 * https://docs.unstructured.io/api-reference/api-services/sdk
 * https://docs.unstructured.io/api-reference/api-services/overview
 * https://docs.unstructured.io/open-source/core-functionality/partitioning
 * https://docs.unstructured.io/open-source/core-functionality/chunking
 */
export class UnstructuredLoader<
  Metadata extends UnstructuredDocumentMetadata = UnstructuredDocumentMetadata
> extends BaseDocumentLoader {
  client: UnstructuredClient;

  filePath?: string | string[];

  fileName?: string;

  buffer?: Buffer;

  partitionViaApi?: boolean;

  postProcessors?: ((str: string) => string)[];

  strategy: UnstructuredLoaderStrategy = "auto";

  unstructuredFields?: Omit<PartitionParameters, "files" | "strategy">;

  enableLogs = false;

  constructor(
    fileOrBuffer: UnstructuredMemoryLoaderOptions,
    fields?: UnstructuredLoaderOptions
  ) {
    super();
    const {
      partitionViaApi,
      postProcessors,
      apiKey,
      client,
      strategy,
      security,
      httpClient,
      server,
      serverURL,
      retryConfig,
      timeoutMs,
      enableLogs,
      ...unstructuredFields
    } = { ...fields };

    if (fileOrBuffer.fileName && fileOrBuffer.filePath) {
      throw new Error("You cannot pass both 'fileName' and 'filePath'.");
    }
    if (fileOrBuffer.buffer && fileOrBuffer.filePath) {
      throw new Error("You cannot pass both 'buffer' and 'filePath'.");
    }
    if (fileOrBuffer.buffer && !fileOrBuffer.fileName) {
      throw new Error("You must pass 'fileName' with 'buffer'.");
    }
    if (!fileOrBuffer.buffer && !fileOrBuffer.filePath) {
      throw new Error("You must pass either 'buffer' or 'filePath'.");
    }

    if (client) {
      const disallowedParams: [string, unknown][] = [
        ["apiKey", apiKey],
        ["serverURL", serverURL],
      ];
      const badParams = disallowedParams
        .filter(([_, value]) => value !== undefined)
        .map(([param]) => param);

      if (badParams.length > 0) {
        throw new Error(
          `If you are passing a custom 'client', you cannot also pass these params: ${badParams.join(
            ", "
          )}.`
        );
      }
      this.client = client;
    } else {
      const unstructuredApiKey =
        apiKey || getEnvironmentVariable("UNSTRUCTURED_API_KEY");
      const unstructuredUrl =
        serverURL || getEnvironmentVariable("UNSTRUCTURED_URL") || _DEFAULT_URL;

      this.client = new UnstructuredClient({
        security: unstructuredApiKey
          ? { apiKeyAuth: unstructuredApiKey }
          : security,
        serverURL: unstructuredUrl,
        retryConfig,
        timeoutMs,
        httpClient,
        server,
      });
    }

    this.filePath = fileOrBuffer?.filePath;
    this.fileName = fileOrBuffer?.fileName;
    this.buffer = fileOrBuffer?.buffer;
    this.partitionViaApi = partitionViaApi;
    this.postProcessors = postProcessors;
    this.strategy = strategy || this.strategy;
    this.unstructuredFields = unstructuredFields;
    this.enableLogs = enableLogs || this.enableLogs;
  }

  mapStrategyToEnum(): StrategyEnum {
    switch (this.strategy) {
      case "fast":
        return StrategyEnum.Fast;
      case "hi_res":
        return StrategyEnum.HiRes;
      case "ocr_only":
        return StrategyEnum.OcrOnly;
      case "auto":
      default:
        return StrategyEnum.Auto;
    }
  }

  async _partition(fileNameOrPath: string): Promise<Element[]> {
    let files:
      | {
          fileName: string;
          content: Uint8Array;
        }
      | undefined;

    if (this.buffer) {
      // If buffer is passed, assume fileNameOrPath is the name
      files = {
        fileName: fileNameOrPath,
        content: new Uint8Array(this.buffer),
      };
    } else {
      files = {
        fileName: path.basename(fileNameOrPath),
        content: new Uint8Array(await fs.promises.readFile(fileNameOrPath)),
      };
    }

    if (!files) {
      throw new Error(`Unable to load files or buffer.`);
    }

    const { info } = console;
    if (!this.enableLogs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.info = (..._args: any) => {};
    }

    try {
      const res = await this.client.general.partition({
        partitionParameters: {
          ...this.unstructuredFields,
          files,
          strategy: this.mapStrategyToEnum(),
        },
      });

      if (!res.elements || res.elements.length === 0) {
        throw new Error("No elements were returned from the Unstructured API.");
      }

      return res.elements.filter(
        (el) => typeof el.text === "string"
      ) as Element[];
    } finally {
      if (!this.enableLogs) {
        console.info = info;
      }
    }
  }

  async load(): Promise<Document<Metadata>[]> {
    let elements: Element[];

    if (Array.isArray(this.filePath)) {
      // Handle multiple files
      elements = (
        await Promise.all(this.filePath.map((fp) => this._partition(fp)))
      ).flat();
    } else {
      elements = await this._partition(this.filePath ?? this.fileName ?? "");
    }

    const documents: DocumentInterface<Metadata>[] = [];
    for (const element of elements) {
      const { metadata, text } = element;
      if (typeof text === "string") {
        documents.push(
          new Document<Metadata>({
            pageContent: text,
            metadata: {
              ...metadata,
              category: element.type,
            } as Metadata,
          })
        );
      }
    }

    return documents;
  }
}
