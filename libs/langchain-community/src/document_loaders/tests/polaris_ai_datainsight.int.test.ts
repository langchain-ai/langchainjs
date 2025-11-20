import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { jest } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { PolarisAIDataInsightLoader } from "../web/polaris_ai_datainsight.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXAMPLES_DIR = path.resolve(
  __dirname,
  "../../document_loaders/tests/example_data/polaris_ai_datainsight"
);
const EXAMPLE_DOC_PATH = path.resolve(EXAMPLES_DIR, "example.docx");
const MOCK_RESPONSE_ZIP_PATH = path.resolve(EXAMPLES_DIR, "example.zip");

interface PageData {
  total: number;
  text?: number;
  image: number;
}

interface ResponseDataStructure {
  elements: {
    total: number;
    text: number;
    image: number;
  };
  pages: {
    total: number;
    [key: string]: PageData | number;
  };
}

const MOCK_RESPONSE_DATA_STRUCTURE: ResponseDataStructure = {
  elements: {
    total: 10,
    text: 5,
    image: 5,
  },
  pages: {
    total: 2,
    "1": {
      total: 7,
      text: 5,
      image: 2,
    },
    "2": {
      total: 3,
      image: 3,
    },
  },
};

describe("PolarisAIDataInsightLoader Integration Tests", () => {
  let tempResourcesDir: string;

  beforeEach(() => {
    tempResourcesDir = fs.mkdtempSync(
      path.join(EXAMPLES_DIR, "/examples/example_")
    );
    jest.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: fs.readFileSync(MOCK_RESPONSE_ZIP_PATH),
    });
  });

  afterEach(() => {
    fs.rmSync(tempResourcesDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it("should load documents in element mode", async () => {
    const loader = new PolarisAIDataInsightLoader({
      filePath: EXAMPLE_DOC_PATH,
      apiKey: "api_key",
      resourcesDir: tempResourcesDir,
      mode: "element",
    });
    const docs = await loader.load();

    expect(docs[0]).toBeInstanceOf(Document);
    expect(docs.length).toBe(MOCK_RESPONSE_DATA_STRUCTURE.elements.total);

    for (const doc of docs) {
      if (doc.metadata.type === "text") {
        expect(doc.pageContent).not.toBe("");
        expect(doc.metadata.resources).toBeUndefined();
      } else {
        const match = doc.pageContent.match(/id="([^"]+)"/);
        expect(match).not.toBeNull();
        if (!match) throw new Error("No image resource ID found");

        const resourceId = match[1];
        const resourcePath = doc.metadata.resources?.[resourceId];
        expect(resourcePath && fs.existsSync(resourcePath)).toBe(true);
        expect(resourcePath && fs.lstatSync(resourcePath).isFile()).toBe(true);
        expect(resourcePath && path.dirname(path.dirname(resourcePath))).toBe(
          tempResourcesDir
        );
      }
    }
  });

  it("should load documents in page mode", async () => {
    const loader = new PolarisAIDataInsightLoader({
      filePath: EXAMPLE_DOC_PATH,
      apiKey: "api_key",
      resourcesDir: tempResourcesDir,
      mode: "page",
    });
    const docs = await loader.load();

    expect(docs[0]).toBeInstanceOf(Document);
    expect(docs.length).toBe(MOCK_RESPONSE_DATA_STRUCTURE.pages.total);

    docs.forEach((doc, i) => {
      const pageId = `${i + 1}`;
      const pageData = MOCK_RESPONSE_DATA_STRUCTURE.pages[
        pageId as keyof typeof MOCK_RESPONSE_DATA_STRUCTURE.pages
      ] as PageData;
      expect(doc.metadata.elements.length).toBe(pageData.total);
      expect(Object.keys(doc.metadata.resources).length).toBe(pageData.image);

      const resourceIds = [
        ...doc.pageContent.matchAll(/<img src="#" alt="" id="([^"]+)"\/>/g),
      ].map((m) => m[1]);
      expect(resourceIds.length).toBe(pageData.image);

      resourceIds.forEach((resourceId) => {
        const resourcePath = doc.metadata.resources?.[resourceId];
        expect(resourcePath && fs.existsSync(resourcePath)).toBe(true);
        expect(resourcePath && fs.lstatSync(resourcePath).isFile()).toBe(true);
        expect(resourcePath && path.dirname(path.dirname(resourcePath))).toBe(
          tempResourcesDir
        );
      });
    });
  });

  it("should load a single document in single mode", async () => {
    const loader = new PolarisAIDataInsightLoader({
      filePath: EXAMPLE_DOC_PATH,
      apiKey: "api_key",
      resourcesDir: tempResourcesDir,
      mode: "single",
    });
    const docs = await loader.load();

    expect(docs[0]).toBeInstanceOf(Document);
    expect(docs.length).toBe(1);

    const doc = docs[0];
    const resourceIds = [
      ...doc.pageContent.matchAll(/<img src="#" alt="" id="([^"]+)"\/>/g),
    ].map((m) => m[1]);
    expect(resourceIds.length).toBe(
      MOCK_RESPONSE_DATA_STRUCTURE.elements.image
    );

    resourceIds.forEach((resourceId) => {
      const resourcePath = doc.metadata.resources?.[resourceId];
      expect(resourcePath && fs.existsSync(resourcePath)).toBe(true);
      expect(resourcePath && fs.lstatSync(resourcePath).isFile()).toBe(true);
      expect(resourcePath && path.dirname(path.dirname(resourcePath))).toBe(
        tempResourcesDir
      );
    });
  });
});
