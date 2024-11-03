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
  const displayName = 'Sherlock Jr. video';

  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const pathToVideoFile = path.join(dirname, "/data/hotdog.jpg");

  const contextCache = new GoogleGenerativeAIContextCache(process.env.GOOGLE_API_KEY || "");
  fileResult = await contextCache.uploadFile(pathToVideoFile, {
    displayName,
    mimeType: 'video/mp4',
  });

  const { name, uri } = fileResult.file;

  // Poll getFile() on a set interval (2 seconds here) to check file state.
  let file = await contextCache.getFile(name);
  while (file.state === FileState.PROCESSING) {
    console.log('Waiting for video to be processed.');
    // Sleep for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    file = await contextCache.getFile(name);
  }
  console.log(`Video processing complete: ${uri}`);

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
});

test("Test Google AI", async () => {
  const res = await model.invoke('Introduce different characters in the movie by describing ' +
    'their personality, looks, and names. Also list the ' +
    'timestamps they were introduced for the first time.');

  console.log(res)
  expect(res).toBeTruthy();
});