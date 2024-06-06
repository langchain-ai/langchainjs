import { test } from "@jest/globals";
import { config } from "dotenv";
import { SessionsPythonREPLTool } from "../tools.js";

config();

test("SessionsPythonREPLTool end-to-end test", async () => {
  const tool = new SessionsPythonREPLTool({
    poolManagementEndpoint: process.env.POOL_MANAGEMENT_ENDPOINT ?? "",
  });
  const result = await tool.invoke("print('Hello, World!')\n1+1");
  expect(result).toBe("Result:\n2\n\nStdout:\nHello, World!\n\n\nStderr:\n");
});

test("SessionsPythonREPLTool upload file end-to-end test", async () => {
  const tool = new SessionsPythonREPLTool({
    poolManagementEndpoint: process.env.POOL_MANAGEMENT_ENDPOINT ?? "",
  });
  const result = await tool.uploadFile({
    data: new Blob(["hello world!"], { type: "application/octet-stream" }),
    remoteFilename: "test.txt",
  });
  expect(result.filename).toBe("test.txt");
  expect(result.size).toBe(12);

  const downloadBlob = await tool.downloadFile({
    remoteFilename: "test.txt",
  });
  const downloadText = await downloadBlob.text();
  expect(downloadText).toBe("hello world!");

  const listResult = await tool.listFiles();
  expect(listResult.length).toBe(1);
});