import { test, expect } from "@jest/globals";

import fs from "node:fs/promises";
import path from "node:path";
import * as os from "node:os";

import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { LocalFileCache } from "../file_system.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tmpDir: string;

describe("Test LocalFileCache", () => {
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "langchain-"));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  test("FSCache with an LLM", async () => {
    const cache = await LocalFileCache.create(tmpDir);

    const model = new OpenAI({ cache });
    const response1 = await model.invoke("What is something random?");
    const response2 = await model.invoke("What is something random?");
    expect(response1).toEqual(response2);
  });

  test("FSCache with a chat model", async () => {
    const cache = await LocalFileCache.create(tmpDir);

    const model = new ChatOpenAI({ cache });
    const response1 = await model.invoke("What is something random?");
    const response2 = await model.invoke("What is something random?");
    expect(response1).not.toBeUndefined();
    console.log(response1, response2);
    expect(response1).toEqual(response2);
  });
});
