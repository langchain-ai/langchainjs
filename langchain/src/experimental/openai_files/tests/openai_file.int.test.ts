import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { OpenAIFiles } from "../index.js";

/**
 * Otherwise we got the error __dirname doesn't exist
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("Use file with Open AI", async () => {
  const openAIFiles = new OpenAIFiles();
  const file = await openAIFiles.createFile({
    file: fs.createReadStream(path.resolve(__dirname, `./test.jsonl`)),
    purpose: "fine-tune",
  });
  expect(file.id).toBeDefined();
  expect(file.object).toBe("file");
  /**
   * Output 
    {
      "id": "file-BK7bzQj3FfZFXr7DbL6xJwfo",
      "object": "file",
      "bytes": 120000,
      "created_at": 1677610602,
      "filename": "salesOverview.pdf",
      "purpose": "assistants",
    }
   */
  const fileContent = await openAIFiles.retrieveFileContent({
    fileId: file.id,
  });
  console.log(fileContent);
  expect(fileContent).toBeDefined();
  /**
   * Output 
    {
      "id": "file-BK7bzQj3FfZFXr7DbL6xJwfo",
      "object": "file",
      "bytes": 120000,
      "created_at": 1677610602,
      "filename": "salesOverview.pdf",
      "purpose": "assistants",
    }
   */
  const retrievedFile = await openAIFiles.retrieveFile({
    fileId: file.id,
  });
  expect(retrievedFile.id).toBeDefined();
  expect(retrievedFile.object).toBe("file");
  /**
   * Output 
    {
      "id": "file-BK7bzQj3FfZFXr7DbL6xJwfo",
      "object": "file",
      "bytes": 120000,
      "created_at": 1677610602,
      "filename": "salesOverview.pdf",
      "purpose": "assistants",
    }
   */
  const list = await openAIFiles.listFiles();
  expect(list).toBeDefined();
  expect(!!list.data.find((f) => f.id === file.id)).toBeTruthy();
  /**
   * Output 
    {
      "id": "file-BK7bzQj3FfZFXr7DbL6xJwfo",
      "object": "file",
      "bytes": 120000,
      "created_at": 1677610602,
      "filename": "salesOverview.pdf",
      "purpose": "assistants",
    }
   */
  const result = await openAIFiles.deleteFile({ fileId: file.id });
  expect(result.id).toBe(file.id);
  expect(result.deleted).toBeTruthy();
  /**
   * Output:
   {
      "id": "file-abc123",
      "object": "file",
      "deleted": true
    }
   */
});
