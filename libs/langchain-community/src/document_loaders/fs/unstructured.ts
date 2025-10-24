import type { basename as BasenameT } from "node:path";
import type { readFile as ReadFileT } from "node:fs/promises";
import { Document } from "@langchain/core/documents";
import { getEnv, getEnvironmentVariable } from "@langchain/core/utils/env";
import { StringWithAutocomplete } from "@langchain/core/utils/types";
import {
  DirectoryLoader,
  UnknownHandling,
  LoadersMapping,
} from "langchain/document_loaders/fs/directory";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

export const UNSTRUCTURED_API_FILETYPES = [
  ".txt",
  ".text",
  ".pdf",
  ".docx",
  ".doc",
  ".jpg",
  ".jpeg",
  ".eml",
  ".html",
  ".htm",
  ".md",
  ".pptx",
  ".ppt",
  ".msg",
  ".rtf",
  ".xlsx",
  ".xls",
  ".odt",
  ".epub",
];

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

/**
 * Represents the available strategies for the UnstructuredLoader. It can
 * be one of "hi_res", "fast", "ocr_only", or "auto".
 */
export type UnstructuredLoaderStrategy =
  | "hi_res"
  | "fast"
  | "ocr_only"
  | "auto";

/**
 * Represents the available hi-res models for the UnstructuredLoader. It can
 * be one of "chipper".
 */
export type HiResModelName = "chipper";

/**
 * To enable or disable table extraction for file types other than PDF, set
 * the skipInferTableTypes property in the UnstructuredLoaderOptions object.
 * The skipInferTableTypes property is an array of file types for which table
 * extraction is disabled. For example, to disable table extraction for .docx
 * and .doc files, set the skipInferTableTypes property to ["docx", "doc"].
 * You can also disable table extraction for all file types other than PDF by
 * setting the skipInferTableTypes property to [].
 */
export type SkipInferTableTypes =
  | "txt"
  | "text"
  | "pdf"
  | "docx"
  | "doc"
  | "jpg"
  | "jpeg"
  | "eml"
  | "html"
  | "htm"
  | "md"
  | "pptx"
  | "ppt"
  | "msg"
  | "rtf"
  | "xlsx"
  | "xls"
  | "odt"
  | "epub";

/**
 * Set the chunking_strategy to chunk text into larger or smaller elements. Defaults to None with optional arg of by_title
 */
export type ChunkingStrategy = "None" | "by_title";

export type UnstructuredLoaderOptions = {
  apiKey?: string;
  apiUrl?: string;
  strategy?: StringWithAutocomplete<UnstructuredLoaderStrategy>;
  encoding?: string;
  ocrLanguages?: Array<string>;
  coordinates?: boolean;
  pdfInferTableStructure?: boolean;
  xmlKeepTags?: boolean;
  skipInferTableTypes?: Array<StringWithAutocomplete<SkipInferTableTypes>>;
  hiResModelName?: StringWithAutocomplete<HiResModelName>;
  includePageBreaks?: boolean;
  chunkingStrategy?: StringWithAutocomplete<ChunkingStrategy>;
  multiPageSections?: boolean;
  combineUnderNChars?: number;
  newAfterNChars?: number;
  maxCharacters?: number;
  extractImageBlockTypes?: string[];
  overlap?: number;
  overlapAll?: boolean;
};

export type UnstructuredDirectoryLoaderOptions = UnstructuredLoaderOptions & {
  recursive?: boolean;
  unknown?: UnknownHandling;
};

export type UnstructuredMemoryLoaderOptions = {
  buffer: Buffer;
  fileName: string;
};

/**
 * A document loader that uses the Unstructured API to load unstructured
 * documents. It supports both the new syntax with options object and the
 * legacy syntax for backward compatibility. The load() method sends a
 * partitioning request to the Unstructured API and retrieves the
 * partitioned elements. It creates a Document instance for each element
 * and returns an array of Document instances.
 *
 * It accepts either a filepath or an object containing a buffer and a filename
 * as input.
 */
export class UnstructuredLoader extends BaseDocumentLoader {
  public filePath: string;

  private buffer?: Buffer;

  private fileName?: string;

  private apiUrl = "https://api.unstructured.io/general/v0/general";

  private apiKey?: string;

  private strategy: StringWithAutocomplete<UnstructuredLoaderStrategy> =
    "hi_res";

  private encoding?: string;

  private ocrLanguages: Array<string> = [];

  private coordinates?: boolean;

  private pdfInferTableStructure?: boolean;

  private xmlKeepTags?: boolean;

  private skipInferTableTypes?: Array<
    StringWithAutocomplete<SkipInferTableTypes>
  >;

  private hiResModelName?: StringWithAutocomplete<HiResModelName>;

  private includePageBreaks?: boolean;

  private chunkingStrategy?: StringWithAutocomplete<ChunkingStrategy>;

  private multiPageSections?: boolean;

  private combineUnderNChars?: number;

  private newAfterNChars?: number;

  private maxCharacters?: number;

  private extractImageBlockTypes?: string[];

  private overlap?: number;

  private overlapAll?: boolean;

  constructor(
    filepathOrBufferOptions: string | UnstructuredMemoryLoaderOptions,
    unstructuredOptions: UnstructuredLoaderOptions | string = {}
  ) {
    super();

    // Temporary shim to avoid breaking existing users
    // Remove when API keys are enforced by Unstructured and existing code will break anyway
    const isLegacySyntax = typeof unstructuredOptions === "string";
    const isMemorySyntax = typeof filepathOrBufferOptions === "object";

    if (isMemorySyntax) {
      this.buffer = filepathOrBufferOptions.buffer;
      this.fileName = filepathOrBufferOptions.fileName;
    } else if (isLegacySyntax) {
      this.filePath = unstructuredOptions;
      this.apiUrl = filepathOrBufferOptions;
    } else {
      this.filePath = filepathOrBufferOptions;
    }

    if (!isLegacySyntax) {
      const options = unstructuredOptions;
      this.apiKey =
        options.apiKey ?? getEnvironmentVariable("UNSTRUCTURED_API_KEY");
      this.apiUrl =
        options.apiUrl ??
        getEnvironmentVariable("UNSTRUCTURED_API_URL") ??
        this.apiUrl;
      this.strategy = options.strategy ?? this.strategy;
      this.encoding = options.encoding;
      this.ocrLanguages = options.ocrLanguages ?? this.ocrLanguages;
      this.coordinates = options.coordinates;
      this.pdfInferTableStructure = options.pdfInferTableStructure;
      this.xmlKeepTags = options.xmlKeepTags;
      this.skipInferTableTypes = options.skipInferTableTypes;
      this.hiResModelName = options.hiResModelName;
      this.includePageBreaks = options.includePageBreaks;
      this.chunkingStrategy = options.chunkingStrategy;
      this.multiPageSections = options.multiPageSections;
      this.combineUnderNChars = options.combineUnderNChars;
      this.newAfterNChars = options.newAfterNChars;
      this.maxCharacters = options.maxCharacters;
      this.extractImageBlockTypes = options.extractImageBlockTypes;
      this.overlap = options.overlap;
      this.overlapAll = options.overlapAll ?? false;
    }
  }

  async _partition() {
    let buffer = this.buffer;
    let fileName = this.fileName;

    if (!buffer) {
      const { readFile, basename } = await this.imports();

      buffer = await readFile(this.filePath);
      fileName = basename(this.filePath);

      // I'm aware this reads the file into memory first, but we have lots of work
      // to do on then consuming Documents in a streaming fashion anyway, so not
      // worried about this for now.
    }

    const formData = new FormData();
    formData.append("files", new Blob([buffer]), fileName);
    formData.append("strategy", this.strategy);
    this.ocrLanguages.forEach((language) => {
      formData.append("ocr_languages", language);
    });
    if (this.encoding) {
      formData.append("encoding", this.encoding);
    }
    if (this.coordinates === true) {
      formData.append("coordinates", "true");
    }
    if (this.pdfInferTableStructure === true) {
      formData.append("pdf_infer_table_structure", "true");
    }
    if (this.xmlKeepTags === true) {
      formData.append("xml_keep_tags", "true");
    }
    if (this.skipInferTableTypes) {
      formData.append(
        "skip_infer_table_types",
        JSON.stringify(this.skipInferTableTypes)
      );
    }
    if (this.hiResModelName) {
      formData.append("hi_res_model_name", this.hiResModelName);
    }
    if (this.includePageBreaks) {
      formData.append("include_page_breaks", "true");
    }
    if (this.chunkingStrategy) {
      formData.append("chunking_strategy", this.chunkingStrategy);
    }
    if (this.multiPageSections !== undefined) {
      formData.append(
        "multipage_sections",
        this.multiPageSections ? "true" : "false"
      );
    }
    if (this.combineUnderNChars !== undefined) {
      formData.append("combine_under_n_chars", String(this.combineUnderNChars));
    }
    if (this.newAfterNChars !== undefined) {
      formData.append("new_after_n_chars", String(this.newAfterNChars));
    }
    if (this.maxCharacters !== undefined) {
      formData.append("max_characters", String(this.maxCharacters));
    }

    if (this.extractImageBlockTypes !== undefined) {
      formData.append(
        "extract_image_block_types",
        JSON.stringify(this.extractImageBlockTypes)
      );
    }

    if (this.overlap !== undefined) {
      formData.append("overlap", String(this.overlap));
    }

    if (this.overlapAll === true) {
      formData.append("overlap_all", "true");
    }

    const headers = {
      "UNSTRUCTURED-API-KEY": this.apiKey ?? "",
    };

    const response = await fetch(this.apiUrl, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to partition file ${this.filePath} with error ${
          response.status
        } and message ${await response.text()}`
      );
    }

    const elements = await response.json();
    if (!Array.isArray(elements)) {
      throw new Error(
        `Expected partitioning request to return an array, but got ${elements}`
      );
    }
    return elements.filter((el) => typeof el.text === "string") as Element[];
  }

  async load(): Promise<Document[]> {
    const elements = await this._partition();

    const documents: Document[] = [];
    for (const element of elements) {
      const { metadata, text } = element;
      if (typeof text === "string" && text !== "") {
        documents.push(
          new Document({
            pageContent: text,
            metadata: {
              ...metadata,
              category: element.type,
            },
          })
        );
      }
    }

    return documents;
  }

  async imports(): Promise<{
    readFile: typeof ReadFileT;
    basename: typeof BasenameT;
  }> {
    try {
      const { readFile } = await import("node:fs/promises");
      const { basename } = await import("node:path");
      return { readFile, basename };
    } catch (e) {
      console.error(e);
      throw new Error(
        `Failed to load fs/promises. TextLoader available only on environment 'node'. It appears you are running environment '${getEnv()}'. See https://<link to docs> for alternatives.`
      );
    }
  }
}

/**
 * A document loader that loads unstructured documents from a directory
 * using the UnstructuredLoader. It creates a UnstructuredLoader instance
 * for each supported file type and passes it to the DirectoryLoader
 * constructor.
 * @example
 * ```typescript
 * const loader = new UnstructuredDirectoryLoader("path/to/directory", {
 *   apiKey: "MY_API_KEY",
 * });
 * const docs = await loader.load();
 * ```
 */
export class UnstructuredDirectoryLoader extends DirectoryLoader {
  constructor(
    directoryPathOrLegacyApiUrl: string,
    optionsOrLegacyDirectoryPath: UnstructuredDirectoryLoaderOptions | string,
    legacyOptionRecursive = true,
    legacyOptionUnknown: UnknownHandling = UnknownHandling.Warn
  ) {
    let directoryPath;
    let options: UnstructuredDirectoryLoaderOptions;
    // Temporary shim to avoid breaking existing users
    // Remove when API keys are enforced by Unstructured and existing code will break anyway
    const isLegacySyntax = typeof optionsOrLegacyDirectoryPath === "string";
    if (isLegacySyntax) {
      directoryPath = optionsOrLegacyDirectoryPath;
      options = {
        apiUrl: directoryPathOrLegacyApiUrl,
        recursive: legacyOptionRecursive,
        unknown: legacyOptionUnknown,
      };
    } else {
      directoryPath = directoryPathOrLegacyApiUrl;
      options = optionsOrLegacyDirectoryPath;
    }
    const loader = (p: string) => new UnstructuredLoader(p, options);
    const loaders = UNSTRUCTURED_API_FILETYPES.reduce(
      (loadersObject: LoadersMapping, filetype: string) => {
        // eslint-disable-next-line no-param-reassign
        loadersObject[filetype] = loader;
        return loadersObject;
      },
      {}
    );
    super(directoryPath, loaders, options.recursive, options.unknown);
  }
}

export { UnknownHandling };
