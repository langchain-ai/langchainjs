/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { config } from "dotenv";
import { SessionsPythonREPLTool } from "../tools.js";

config();

/*
 * To run these tests, you need have an Azure Container Apps dynamic session
 * instance running.
 * See the following link for more information:
 * https://learn.microsoft.com/azure/container-apps/sessions
 *
 * Once you have the instance running, you need to set the following environment
 * variable before running the test:
 * - AZURE_CONTAINER_APP_SESSION_POOL_MANAGEMENT_ENDPOINT
 */

test("SessionsPythonREPLTool end-to-end test", async () => {
  const tool = new SessionsPythonREPLTool();
  const result = await tool.invoke("print('Hello, World!')\n1+1");
  expect(JSON.parse(result)).toStrictEqual({
    stdout: "Hello, World!\n",
    stderr: "",
    result: 2,
  });
});

test("SessionsPythonREPLTool upload file end-to-end test", async () => {
  const tool = new SessionsPythonREPLTool();
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
