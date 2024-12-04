/* eslint-disable no-process-env */

import { test } from "@jest/globals";

import { fileURLToPath } from "node:url";
import * as path from "node:path";

import {
  FileState,
  UploadFileResponse,
  GoogleAIFileManager,
  GoogleAICacheManager,
} from "@google/generative-ai/server";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

const model = new ChatGoogleGenerativeAI({});
let fileResult: UploadFileResponse;

beforeAll(async () => {
  const displayName = "Gettysburg audio";

  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const pathToVideoFile = path.join(dirname, "/data/gettysburg10.wav");

  const contextCache = new GoogleAICacheManager(
    process.env.GOOGLE_API_KEY || ""
  );
  const fileCache = new GoogleAIFileManager(process.env.GOOGLE_API_KEY || "");
  fileResult = await fileCache.uploadFile(pathToVideoFile, {
    displayName,
    mimeType: "audio/wav",
  });

  const { name } = fileResult.file;

  // Poll getFile() on a set interval (2 seconds here) to check file state.
  let file = await fileCache.getFile(name);
  while (file.state === FileState.PROCESSING) {
    // Sleep for 2 seconds
    await new Promise((resolve) => {
      setTimeout(resolve, 2_000);
    });
    file = await fileCache.getFile(name);
  }

  const systemInstruction =
    "You are an expert audio analyzer, and your job is to answer " +
    "the user's query based on the audio file you have access to.";
  const cachedContent = await contextCache.create({
    model: "models/gemini-1.5-flash-001",
    displayName: "gettysburg audio",
    systemInstruction,
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              mimeType: fileResult.file.mimeType,
              fileUri: fileResult.file.uri,
            },
          },
        ],
      },
    ],
    ttlSeconds: 300,
  });

  model.useCachedContent(cachedContent);
}, 10 * 60 * 1000); // Set timeout to 10 minutes to upload file

test("Test Google AI", async () => {
  const res = await model.invoke("Transcribe the provided audio clip");

  console.log(res);
  expect(res).toBeTruthy();
});
