// PolarisAIDataInsight document loader for LangChain.js

import fs from "fs";
import path from "path";
import axios, { AxiosResponse } from "axios";
import unzipper from "unzipper";
import mime from "mime-types";
import FormData from "form-data";
import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

export const SUPPORTED_EXTENSIONS = [
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".hwp",
  ".hwpx",
];

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

export class PolarisAIDataInsightLoader extends BaseDocumentLoader {
  private blob: PolarisBlob;

  private apiKey: string;

  private apiUrl =
    "https://datainsight-api.polarisoffice.com/api/v1/datainsight/doc-extract";

  private resourcesDir: string;

  private mode: DataInsightModeType;

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

    if (!this.validateExtension(this.blob.metadata.filename)) {
      throw new Error(
        `Unsupported file extension. Supported extensions are: ${SUPPORTED_EXTENSIONS.join(
          ", "
        )}`
      );
    }

    if (!fs.existsSync(this.resourcesDir)) {
      fs.mkdirSync(this.resourcesDir, { recursive: true });
    }
  }

  private validateExtension(filename: string): boolean {
    return SUPPORTED_EXTENSIONS.includes(path.extname(filename).toLowerCase());
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
    return this._convertJsonToDocuments(jsonData, imagePathsMap);
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
    if (!jsonData.pages || !Array.isArray(jsonData.pages)) {
      throw new Error("Invalid JSON data structure.");
    }
    if (!jsonData.pages[0].elements) {
      throw new Error(
        "Invalid JSON data structure. Missing elements in the first page."
      );
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

  private _convertJsonToDocuments(
    jsonData: { pages: DocPage[] },
    imagePathsMap: Record<string, string>
  ): Document[] {
    if (this.mode === "element") {
      return jsonData.pages.flatMap((page) =>
        page.elements.map((element) =>
          this._renderElement(element, imagePathsMap)
        )
      );
    }

    if (this.mode === "page") {
      return jsonData.pages.map((page) => {
        const contentParts: string[] = [];
        const metadata = {
          elements: [] as Record<string, unknown>[],
          resources: {} as Record<string, string>,
        };
        for (const element of page.elements) {
          const doc = this._renderElement(element, imagePathsMap);
          contentParts.push(doc.pageContent);
          metadata.elements.push(doc.metadata);
          if (doc.metadata.resources)
            Object.assign(metadata.resources, doc.metadata.resources);
        }
        return new Document({ pageContent: contentParts.join("\n"), metadata });
      });
    }

    const contentParts: string[] = [];
    const metadata = {
      elements: [] as Record<string, unknown>[],
      resources: {} as Record<string, string>,
    };
    for (const page of jsonData.pages) {
      for (const element of page.elements) {
        const doc = this._renderElement(element, imagePathsMap);
        contentParts.push(doc.pageContent);
        metadata.elements.push(doc.metadata);
        if (doc.metadata.resources)
          Object.assign(metadata.resources, doc.metadata.resources);
      }
    }
    return [new Document({ pageContent: contentParts.join("\n"), metadata })];
  }

  private _renderElement(
    element: DocElement,
    imagePathsMap: Record<string, string>
  ): Document {
    const type = element.type;
    const content = element.content ?? {};
    const metadata: Record<string, unknown> = {
      type,
      coordinates: element.boundaryBox,
    };

    if (type === "text") {
      return new Document({ pageContent: content.text || "", metadata });
    }

    if (type === "table") {
      const tableId = `di.table.${element.id}`;
      const tableContent = content.json || content.csv;
      if (!tableContent)
        throw new Error(`Table content not found for ${element.id} element`);
      metadata.resources = { [tableId]: tableContent };
      return new Document({ pageContent: `<div id="${tableId}"/>`, metadata });
    }

    if (type === "chart") {
      const chartId = `di.chart.${element.id}`;
      if (!content.csv || !content.src)
        throw new Error(`Chart content not found for ${element.id} element`);
      metadata.resources = {
        [chartId]: { src: content.src, csv: content.csv },
      };
      return new Document({ pageContent: `<div id="${chartId}"/>`, metadata });
    }

    if (type === "image") {
      const src = content.src;
      const fileName = path.basename(src ?? "");
      if (!src || !imagePathsMap[fileName])
        throw new Error(`Image path not found for ${fileName}`);
      metadata.resources = { [fileName]: imagePathsMap[fileName] };
      return new Document({
        pageContent: `<img src="#" alt="" id="${fileName}"/>`,
        metadata,
      });
    }

    return new Document({
      pageContent: "[Unsupported element type]",
      metadata,
    });
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
