import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PolarisAIDataInsightLoader } from "../web/polaris_ai_datainsight.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXAMPLES_DIR = path.resolve(
  __dirname,
  "../../document_loaders/tests/example_data/polaris_ai_datainsight"
);
const EXAMPLE_DOC_PATH = path.join(EXAMPLES_DIR, "example.docx");
const EXAMPLE_UNSUPPORTED_DOC_PATH = path.join(EXAMPLES_DIR, "example.txt");
const EXAMPLE_NOT_EXIST_DOC_PATH = path.join(EXAMPLES_DIR, "no_file.docx");

// -- For Success Test -- //
describe("PolarisAIDataInsightLoader - Success Initialization", () => {
  test("should initialize with filePath", () => {
    const loader = new PolarisAIDataInsightLoader({
      filePath: EXAMPLE_DOC_PATH,
      apiKey: "api_key",
      resourcesDir: EXAMPLES_DIR,
    });

    expect(loader).toBeDefined();
  });

  test("should initialize with file and filename", () => {
    const buffer = fs.readFileSync(EXAMPLE_DOC_PATH);
    const loader = new PolarisAIDataInsightLoader({
      file: buffer,
      filename: path.basename(EXAMPLE_DOC_PATH),
      apiKey: "api_key",
      resourcesDir: EXAMPLES_DIR,
    });

    expect(loader).toBeDefined();
  });
});

// -- For Failure Test -- //
describe("PolarisAIDataInsightLoader - Failure Initialization", () => {
  test("should throw error when both filePath and file are provided", () => {
    const buffer = fs.readFileSync(EXAMPLE_DOC_PATH);
    expect(() => {
      const loader = new PolarisAIDataInsightLoader({
        filePath: EXAMPLE_DOC_PATH,
        file: buffer,
        filename: path.basename(EXAMPLE_DOC_PATH),
        apiKey: "api_key",
        resourcesDir: EXAMPLES_DIR,
      });
    }).toThrow("Both file_path and file/filename provided");
  });

  test("should throw error when only file is provided without filename", () => {
    const buffer = fs.readFileSync(EXAMPLE_DOC_PATH);
    expect(() => {
      const loader = new PolarisAIDataInsightLoader({
        file: buffer,
        apiKey: "api_key",
        resourcesDir: EXAMPLES_DIR,
      });
    }).toThrow(
      "When using file data, both `file` and `filename` must be provided."
    );
  });

  test("should throw error when non-existent filePath is provided", () => {
    expect(() => {
      const loader = new PolarisAIDataInsightLoader({
        filePath: EXAMPLE_NOT_EXIST_DOC_PATH,
        apiKey: "api_key",
        resourcesDir: EXAMPLES_DIR,
      });
    }).toThrow(/does not exist/);
  });

  test("should throw error when unsupported file type is provided (filePath)", () => {
    expect(() => {
      const loader = new PolarisAIDataInsightLoader({
        filePath: EXAMPLE_UNSUPPORTED_DOC_PATH,
        apiKey: "api_key",
        resourcesDir: EXAMPLES_DIR,
      });
    }).toThrow(/Unsupported file extension/);
  });

  test("should throw error when unsupported file type is provided (file buffer)", () => {
    const buffer = fs.readFileSync(EXAMPLE_UNSUPPORTED_DOC_PATH);
    expect(() => {
      const loader = new PolarisAIDataInsightLoader({
        file: buffer,
        filename: path.basename(EXAMPLE_UNSUPPORTED_DOC_PATH),
        apiKey: "api_key",
        resourcesDir: EXAMPLES_DIR,
      });
    }).toThrow(/Unsupported file extension/);
  });
});
