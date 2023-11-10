import * as fs from "fs";
import * as path from "path";
import { OpenAIFiles } from "../index.js";

test("Send a file to Open AI", async () => {
  const file = await OpenAIFiles.create({
    file: fs.createReadStream(path.resolve(__dirname, `./test.txt`)),
    purpose: "assistants",
  });
  console.log(file);
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
  const result = await OpenAIFiles.del({ fileId: file.id });
  console.log(result);
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
