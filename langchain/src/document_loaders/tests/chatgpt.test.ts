import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";
import { ChatGPTLoader } from "../fs/chatgpt.js";

test("Test ChatGPT loader to load all documents", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/chatgpt/example_conversations.json"
  );
  const loader = new ChatGPTLoader(filePath);
  const docs = await loader.load();
  expect(docs.length).toBe(2);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, logIndex: 1 },
      pageContent:
        "Example Usage - user on 2023-10-16 23:40:17: Hello, what is your name?\n\nExample Usage - assistant on 2023-10-16 23:40:23: Hello! I'm just a computer program created by OpenAI, so I don't have a personal name. You can call me ChatGPT or simply ask me any questions or chat about topics you're interested in. How can I assist you today?\n\n",
    })
  );
  expect(docs[1]).toEqual(
    new Document({
      metadata: { source: filePath, logIndex: 2 },
      pageContent:
        "Example Usage 2 - user on 2023-10-13 23:02:19: What should I do today?\n\nExample Usage 2 - assistant on 2023-10-13 23:02:27: You should contribute to LangChain!\n\nExample Usage 2 - user on 2023-10-13 23:03:30: How can I start?\n\nExample Usage 2 - assistant on 2023-10-13 23:03:38: You can take a look at the current LangChain issues and see if you can contribute to any! Don't forget to read the contributing.md file.\n\nExample Usage 2 - user on 2023-10-13 23:09:24: Thank you!\n\nExample Usage 2 - assistant on 2023-10-13 23:09:34: You're welcome! If you have any more questions or need further assistance in the future, feel free to reach out.\n\n",
    })
  );
});

test("Test ChatGPT loader to only load 1 document", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/chatgpt/example_conversations.json"
  );
  const loader = new ChatGPTLoader(filePath, 1);
  const docs = await loader.load();
  expect(docs.length).toBe(1);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, logIndex: 1 },
      pageContent:
        "Example Usage - user on 2023-10-16 23:40:17: Hello, what is your name?\n\nExample Usage - assistant on 2023-10-16 23:40:23: Hello! I'm just a computer program created by OpenAI, so I don't have a personal name. You can call me ChatGPT or simply ask me any questions or chat about topics you're interested in. How can I assist you today?\n\n",
    })
  );
});
