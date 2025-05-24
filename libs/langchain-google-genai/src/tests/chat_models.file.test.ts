/* eslint-disable no-process-env */

import { test } from "@jest/globals";
import * as fs from "node:fs/promises";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

test.only("file uploads", async () => {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash-preview-05-20",
    maxRetries: 0,
  });

  const fileAsBase64 = await fs.readFile(
    "../../examples/src/document_loaders/example_data/bitcoin.pdf",
    "base64"
  );
  console.log("fileAsBase64.slice(0, 100)\n", fileAsBase64.slice(0, 100));

  const response = await model.invoke([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Summarize this pdf file",
        },
        {
          type: "file",
          source_type: "base64",
          data: fileAsBase64,
          mime_type: "application/pdf",
          metadata: {
            filename: "bitcoin.pdf",
          },
        },
      ],
    },
  ]);

  console.log(response.content);
});
