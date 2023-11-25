import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from '@jest/globals';
import { Document } from "../../document.js";
import { ChatGPTLoader } from '../fs/chatgpt.js';

test('Test ChatGPT loader to load all documents', async () => {
    const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/example_conversations.json"
    );
    const loader = new ChatGPTLoader(filePath);
    const docs = await loader.load();
    expect(docs.length).toBe(2);
    expect(docs[0]).toEqual(
        new Document({
            metadata: {'source': './example_data/example_conversations.json'},
            pageContent: "Example Usage - user on 2023-06-16 05:26:57: Hello, what is your name?\n\nExample Usage - assistant on 2023-06-16 05:27:03: Hello! I'm just a computer program created by OpenAI, so I don't have a personal name. You can call me ChatGPT or simply ask me any questions or chat about topics you're interested in. How can I assist you today?\n\n",
          
        })
    );
    expect(docs[1]).toEqual(
        new Document({
            metadata: {'source': './example_data/example_conversations.json'},
            pageContent: "Example Usage 2 - user on 2023-06-11 00:48:59: What should I do today?\n\nExample Usage 2 - assistant on 2023-06-11 00:49:07: You should contribute to LangChain!\n\nExample Usage 2 - user on 2023-06-11 00:50:10: How can I start?\n\nExample Usage 2 - assistant on 2023-06-11 00:50:18: You can take a look at the current LangChain issues and see if you can contribute to any! Don't forget to read the contributing.md file.\n\nExample Usage 2 - user on 2023-06-11 01:56:04: Thank you!\n\nExample Usage 2 - assistant on 2023-06-11 01:56:14: You're welcome! If you have any more questions or need further assistance in the future, feel free to reach out.\n\n",
        })
    );
});

test('Test ChatGPT loader to only load 1 document', async () => {
    const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/example_conversations.json"
    );
    const loader = new ChatGPTLoader(filePath, 1);
    const docs = await loader.load();
    expect(docs.length).toBe(1);
    expect(docs[0]).toEqual(
        new Document({
            metadata: {'source': './example_data/example_conversations.json'},
            pageContent: "Example Usage - user on 2023-06-16 05:26:57: Hello, what is your name?\n\nExample Usage - assistant on 2023-06-16 05:27:03: Hello! I'm just a computer program created by OpenAI, so I don't have a personal name. You can call me ChatGPT or simply ask me any questions or chat about topics you're interested in. How can I assist you today?\n\n",
        })
    );
});
