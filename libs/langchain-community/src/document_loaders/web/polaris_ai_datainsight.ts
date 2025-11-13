// PolarisAIDataInsight document loader for LangChain.js

import fs from "fs";
import path from "path";
import axios, { AxiosResponse } from "axios";
import unzipper from "unzipper";
import mime from "mime-types";
import FormData from "form-data";
import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

const SPLIT_CHAR = "\n\n";
export type DataInsightModeType = "element" | "page" | "single";

export interface PolarisBlob {
  data: Buffer;
  mimetype: string;
  metadata: Record<string, string>;
}

export interface PolarisAIDataInsightLoaderParams {
  filePath?: string;
  file?: Buffer;
  filename?: string;
  apiKey?: string;
  apiUrl?: string;
  resourcesDir?: string;
  mode?: DataInsightModeType;
}

interface ElementContent {
  text?: string;
  json?: string;
  csv?: string;
  src?: string;
  html?: string;
  title?: string;
  series_names?: string[];
  x_axis_labels?: string[];
  y_axis_main_scale?: number[];
  rawMath_value?: string;
  rawMath_format?: string;
}

interface DocElement {
  id?: string;
  type: string;
  content?: ElementContent;
  boundaryBox?: Record<string, unknown>;
}

interface DocPage {
  elements: DocElement[];
}

/**
 * Polaris AI DataInsight Document Loader.
 *
 * This loader extracts text, images, and other objects from various document formats.
 *
 * Setup:
 *     Install `langchain-community` and set environment variable `POLARIS_AI_DATA_INSIGHT_API_KEY`.
 *
 *     ```bash
 *         npm install @langchain/community
 *         export POLARIS_AI_DATA_INSIGHT_API_KEY="your-api-key"
 *     ```
 *
 * Instantiate:
 *     - Using a file path:
 *
 *         ```typescript
 *         import { PolarisAIDataInsightLoader } from "@langchain/community/document_loaders/web/polaris_ai_datainsight";
 *
 *         const loader = new PolarisAIDataInsightLoader({
 *             filePath: "path/to/file.docx",
 *             resourcesDir: "path/to/save/resources/"
 *         });
 *         ```
 *
 *     - Using file data and filename:
 *
 *         ```typescript
 *         import { PolarisAIDataInsightLoader } from "@langchain/community/document_loaders/web/polaris_ai_datainsight";
 *         import fs from "fs";
 *
 *         const loader = new PolarisAIDataInsightLoader({
 *             file: fs.readFileSync("path/to/file.docx"),
 *             filename: "file.docx",
 *             resourcesDir: "path/to/save/resources/"
 *         });
 *         ```
 *
 * Load:
 *     ```typescript
 *         const docs = await loader.load();
 *
 *         console.log(docs[0].pageContent.substring(0, 100));
 *         console.log(docs[0].metadata);
 *     ```
 */
export class PolarisAIDataInsightLoader extends BaseDocumentLoader {
  private blob: PolarisBlob;

  private apiKey: string;

  private apiUrl =
    "https://datainsight-api.polarisoffice.com/api/v1/datainsight/doc-extract";

  private resourcesDir: string;

  private mode: DataInsightModeType;

  /**
   * Initialize the instance.
   *
   * The instance can be initialized in two ways:
   * 1. Using a file path: provide the `filePath` parameter
   * 2. Using bytes data: provide both `file` and `filename` parameters
   *
   * Note:
   *     If you provide both `filePath` and `file`/`filename`,
   *     an Error will be thrown.
   *
   * @param options - Configuration options for the loader
   * @param options.filePath - Path to the file to process. Use instead of `file` and `filename`.
   * @param options.file - Buffer data of the file to process. Use instead of `filePath` and must be provided with `filename`.
   * @param options.filename - Name of the file when using buffer data. Must be provided with `file`.
   * @param options.apiKey - API authentication key. If not provided, the API key will be retrieved from environment variable. If no API key is found, an Error is thrown.
   * @param options.resourcesDir - Resource directory path. If the directory does not exist, it will be created. Defaults to "app/".
   * @param options.mode - Document loader mode. Valid options are "element", "page", or "single". Defaults to "single".
   *
   * Mode:
   *     The mode parameter determines how the document is loaded:
   *         `element`: Load each element in the pages as a separate Document object.
   *         `page`: Load each page in the document as a separate Document object.
   *         `single`: Load the entire document as a single Document object.
   *
   * Example:
   *     - Using a file path:
   *
   *         ```typescript
   *         const loader = new PolarisAIDataInsightLoader({
   *             filePath: "path/to/file.docx",
   *             apiKey: "your-api-key",         // or set as environment variable
   *             resourcesDir: "path/to/save/resources/"
   *         });
   *         ```
   *
   *     - Using file data and filename:
   *
   *         ```typescript
   *         const loader = new PolarisAIDataInsightLoader({
   *             file: fs.readFileSync("path/to/file.docx"),
   *             filename: "file.docx",
   *             apiKey: "your-api-key",         // or set as environment variable
   *             resourcesDir: "path/to/save/resources/"
   *         });
   *         ```
   */
  constructor(options: PolarisAIDataInsightLoaderParams) {
    super();
    const {
      filePath,
      file,
      filename,
      apiKey,
      resourcesDir = "app/",
      mode = "single",
    } = options;

    if (!apiKey)
      throw new Error(
        "API key is not provided. Please pass the `apiKey` as a parameter."
      );

    this.apiKey = apiKey;
    this.resourcesDir = resourcesDir;
    this.mode = mode;

    if ((file && !filename) || (!file && filename)) {
      throw new Error(
        "When using file data, both `file` and `filename` must be provided."
      );
    }

    if (!filePath && !(file && filename)) {
      throw new Error("Either filePath or file/filename must be provided.");
    }

    if (filePath && (file || filename)) {
      throw new Error(
        "Both file_path and file/filename provided. Please provide only one valid combination."
      );
    }

    if (filePath) {
      if (!fs.existsSync(filePath))
        throw new Error(`File ${filePath} does not exist.`);
      this.blob = {
        data: fs.readFileSync(filePath),
        mimetype: determineMimeType(filePath),
        metadata: { filename: path.basename(filePath) },
      };
    } else if (file && filename) {
      this.blob = {
        data: file,
        mimetype: determineMimeType(filename),
        metadata: { filename },
      };
    } else {
      throw new Error("Invalid file input.");
    }

    if (!fs.existsSync(this.resourcesDir)) {
      fs.mkdirSync(this.resourcesDir, { recursive: true });
    }
  }

  /**
   * Get the list of supported modes.
   *
   * @returns Array of supported mode strings
   */
  get supportedModes(): string[] {
    return ["element", "page", "single"];
  }

  public async load(): Promise<Document[]> {
    const unzipDir = await createTempDir(this.resourcesDir);
    const response = await this._getResponse();
    const { jsonData, imagePathsMap } = await this._unzipResponse(
      response,
      unzipDir
    );
    this._validateDataStructure(jsonData);
    this._postprocessJson(jsonData, imagePathsMap);
    return this._convertJsonToDocuments(jsonData);
  }

  private async _getResponse(): Promise<AxiosResponse> {
    const formData = new FormData();
    formData.append("file", this.blob.data, {
      filename: this.blob.metadata.filename,
      contentType: this.blob.mimetype,
    });

    const headers = {
      "x-po-di-apikey": this.apiKey,
      ...formData.getHeaders(),
    };

    try {
      return await axios.post(this.apiUrl, formData, {
        headers,
        responseType: "arraybuffer",
      });
    } catch (error: unknown) {
      const err = error as { response?: { data?: string }; message: string };
      if (err.response?.data)
        throw new Error(`HTTP error: ${err.response.data}`);
      throw new Error(`Failed to send request: ${err.message}`);
    }
  }

  private async _unzipResponse(
    response: AxiosResponse,
    dirPath: string
  ): Promise<{
    jsonData: { pages: DocPage[] };
    imagePathsMap: Record<string, string>;
  }> {
    const zipPath = path.join(dirPath, "response.zip");
    fs.writeFileSync(zipPath, response.data);

    const unzipStream = unzipper.Extract({ path: dirPath });
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipStream as unknown as NodeJS.WritableStream)
        .on("close", resolve)
        .on("error", reject);
    });

    const files = await fs.promises.readdir(dirPath);
    const jsonFile = files.find((f) => f.endsWith(".json"));
    if (!jsonFile) throw new Error("No JSON file found in the response.");

    const imagePathsMap: Record<string, string> = {};
    for (const file of files) {
      if (file.endsWith(".png")) {
        imagePathsMap[file] = path.join(dirPath, file);
      }
    }

    const jsonContent = await fs.promises.readFile(
      path.join(dirPath, jsonFile),
      "utf-8"
    );
    try {
      const jsonData = JSON.parse(jsonContent);
      return { jsonData, imagePathsMap };
    } catch (e) {
      throw new Error(`Failed to decode JSON response: ${e}`);
    }
  }

  private _validateDataStructure(jsonData: { pages: DocPage[] }) {
    if (!("pages" in jsonData)) {
      throw new Error("Invalid JSON data structure.");
    }
    if (!jsonData.pages[0] || !("elements" in jsonData.pages[0])) {
      throw new Error("Invalid JSON data structure.");
    }
  }

  private _postprocessJson(
    jsonData: { pages: DocPage[] },
    imagePathsMap: Record<string, string>
  ) {
    for (const page of jsonData.pages) {
      for (const element of page.elements) {
        if (element.type === "image") {
          const src = element.content?.src;
          if (src && imagePathsMap[src] && element.content) {
            element.content.src = imagePathsMap[src];
          } else {
            throw new Error(`Image path not found for ${src}`);
          }
        }
      }
    }
  }

  /**
   * Convert JSON data to Document objects.
   *
   * @param jsonData - JSON data to convert
   * @returns List of Document objects
   */
  private _convertJsonToDocuments(jsonData: { pages: DocPage[] }): Document[] {
    if (this.mode === "element") {
      const documentList: Document[] = [];
      for (const docPage of jsonData.pages) {
        for (const docElement of docPage.elements) {
          const [elementContent, elementMetadata] =
            this._parseDocElement(docElement);
          documentList.push(
            new Document({
              pageContent: elementContent,
              metadata: elementMetadata,
            })
          );
        }
      }
      return documentList;
    } else if (this.mode === "page") {
      const documentList: Document[] = [];
      for (const docPage of jsonData.pages) {
        let pageContent = "";
        const pageMetadata: Record<string, any> = {};

        // Parse elements in the page
        for (const docElement of docPage.elements) {
          const [elementContent, elementMetadata] =
            this._parseDocElement(docElement);
          // Add element content to page content
          pageContent += elementContent + SPLIT_CHAR;
          // Add element metadata to page metadata
          pageMetadata[elementMetadata.id] = elementMetadata;
        }

        // Add page document
        documentList.push(
          new Document({ pageContent, metadata: pageMetadata })
        );
      }
      return documentList;
    } else {
      let docContent = "";
      const docMetadata: Record<string, any> = {};
      // Parse elements in the document
      for (const docPage of jsonData.pages) {
        for (const docElement of docPage.elements) {
          const [elementContent, elementMetadata] =
            this._parseDocElement(docElement);
          // Add element content to document content
          docContent += elementContent + SPLIT_CHAR;
          // Add element metadata to document metadata
          docMetadata[elementMetadata.id] = elementMetadata;
        }
      }

      return [new Document({ pageContent: docContent, metadata: docMetadata })];
    }
  }

  /**
   * Parse a document element and extract its content and metadata.
   *
   * @param docElement - The document element to parse
   * @returns The extracted content and metadata as a tuple
   */
  private _parseDocElement(
    docElement: DocElement
  ): [string, Record<string, any>] {
    const elementId = docElement.id;
    const dataType = docElement.type;
    const content = docElement.content ?? {};

    let elementContent = "";
    let elementMetadata: Record<string, any> = {};

    if (dataType === "table") {
      const tableId = `di.table.${elementId}`;
      if (!content.html) {
        throw new Error(`Table content not found for ${elementId} element`);
      }

      // Get data from parsing output
      let htmlTable = content.html;
      htmlTable = htmlTable.replace(/<table[^>]*>/g, "<table>");

      elementContent = htmlTable;
      elementMetadata = {
        id: tableId,
        type: "table",
      };
    } else if (dataType === "chart") {
      // Get data from parsing output
      const chartId = `di.chart.${elementId}`;
      const chartTitle = content.title || "";
      const chartImage = content.src || "";
      const chartContent = content.csv || "";
      const chartSeriesNames = content.series_names || [];
      const chartXAxisLabels = content.x_axis_labels || [];
      const chartYAxisMainScale = content.y_axis_main_scale || [];

      if (!chartImage) {
        throw new Error(`Image path not found for ${chartImage}`);
      }
      if (!chartContent) {
        throw new Error(`Chart content not found for ${elementId} element`);
      }

      // Make content and metadata
      const cleanChartContent = chartContent.replace(/\r\n/g, "\n").trim();
      elementContent =
        `<figure id="${chartId}" data-category="${dataType}">` +
        `<figcaption> ${chartTitle} </figcaption>` +
        `<pre data-format="csv"> ${cleanChartContent} </pre>` +
        `</figure>`;

      elementMetadata = {
        id: chartId,
        type: "chart",
        src: chartImage,
        series_names: chartSeriesNames,
        x_axis_labels: chartXAxisLabels,
        y_axis_main_scale: chartYAxisMainScale,
      };
    } else if (dataType === "equation") {
      // Get data from parsing output
      const equationId = `di.equation.${elementId}`;
      const equationImage = content.src || "";
      const equationValue = content.rawMath_value || "";
      const equationFormat = content.rawMath_format || "";

      if (!equationValue) {
        console.warn(
          `Equation rawMath_value not found for ${elementId} element`
        );
      }
      if (!equationFormat) {
        console.warn(
          `Equation rawMath_format not found for ${elementId} element`
        );
      }

      // Make content and metadata
      elementContent =
        `<figure id="${equationId}" data-category="${dataType}">` +
        `<pre data-format="${equationFormat}"> ${equationValue} </pre>` +
        `</figure>`;

      elementMetadata = {
        id: equationId,
        type: "equation",
        src: equationImage,
      };
    } else if (dataType === "image") {
      // Get data from parsing output
      const imageId = `di.image.${elementId}`;
      const imagePath = content.src; // image filename

      if (!imagePath) {
        throw new Error(`Image path not found for ${imagePath}`);
      }

      // Make content and metadata
      elementContent = `<img id="${imageId}" data-category="${dataType}"/>`;
      elementMetadata = {
        id: imageId,
        type: "image",
        src: imagePath,
      };
    } else {
      // text, header, footer
      const textId = `di.text.${elementId}`;

      elementContent = content.text || "";
      if (!elementContent) {
        console.warn(`Text content not found for ${textId} element`);
      }

      elementMetadata = {
        id: textId,
        type: "text",
      };
    }

    return [elementContent, elementMetadata];
  }
}

export function determineMimeType(filename: string): string {
  return mime.lookup(filename) || "application/octet-stream";
}

export async function createTempDir(baseDir: string): Promise<string> {
  return await fs.promises.mkdtemp(path.join(baseDir, "tmp-"));
}

export function createBlobFromPath(
  filePath: string,
  mimeType: string,
  metadata: Record<string, string> = {}
): PolarisBlob {
  const data = fs.readFileSync(filePath);
  return { data, mimetype: mimeType, metadata };
}

export function createBlobFromData(
  data: Buffer,
  mimeType: string,
  metadata: Record<string, string> = {}
): PolarisBlob {
  return { data, mimetype: mimeType, metadata };
}
