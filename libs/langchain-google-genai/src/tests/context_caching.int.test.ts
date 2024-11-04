/* eslint-disable no-process-env */

import { test } from "@jest/globals";

import { ChatGoogleGenerativeAI } from "../chat_models.js";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

import {
  FileState,
  UploadFileResponse,
} from '@google/generative-ai/server';
import { GoogleGenerativeAIContextCache } from "../context_caching.js";

const model = new ChatGoogleGenerativeAI({});
let fileResult: UploadFileResponse;

beforeAll(async () => {
  // Download video file and save in src/tests/data
  // curl -O https://storage.googleapis.com/generativeai-downloads/data/Sherlock_Jr_FullMovie.mp4
  const displayName = 'Sherlock Jr. video';

  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const pathToVideoFile = path.join(dirname, "/data/Sherlock_Jr_FullMovie.mp4");

  const contextCache = new GoogleGenerativeAIContextCache(process.env.GOOGLE_API_KEY || "");
  fileResult = await contextCache.uploadFile(pathToVideoFile, {
    displayName,
    mimeType: 'video/mp4',
  });

  const { name } = fileResult.file;

  // Poll getFile() on a set interval (2 seconds here) to check file state.
  let file = await contextCache.getFile(name);
  while (file.state === FileState.PROCESSING) {
    // Sleep for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    file = await contextCache.getFile(name);
  }

  const systemInstruction =
    'You are an expert video analyzer, and your job is to answer ' +
    "the user's query based on the video file you have access to.";
  const cachedContent = await contextCache.createCache({
    model: 'models/gemini-1.5-flash-001',
    displayName: 'sherlock jr movie',
    systemInstruction,
    contents: [
      {
        role: 'user',
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

  model.enableCachedContent(cachedContent);
}, 10 * 60 * 1000); // Set timeout to 10 minutes to upload file

test("Test Google AI", async () => {
  const res = await model.invoke('Introduce different characters in the movie by describing ' +
    'their personality, looks, and names. Also list the ' +
    'timestamps they were introduced for the first time.');

  console.log(res);
  expect(res).toBeTruthy();
});