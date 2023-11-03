import path from "node:path";
import { glob } from "glob";
import { BaseChatModel } from "../src/chat_models/base";
import fs from "fs/promises";

const LLM_IGNORE = [
  "FakeListChatModel",
  "BaseChatModel",
  "SimpleChatModel",
  "BaseChatIflytekXinghuo",
  "BaseChatGoogleVertexAI",
];

const LLM_DOC_TEXT = `---
sidebar_position: 0
sidebar_class_name: hidden
---

# LLMs

## Features (natively supported)

All LLMs implement the Runnable interface, which comes with default implementations of all methods, ie. \`invoke\`, \`batch\`, \`stream\`, \`map\`. This gives all LLMs basic support for invoking, streaming, batching and mapping requests, which by default is implemented as below:

- _Streaming_ support defaults to returning an \`AsyncIterator\` of a single value, the final result returned by the underlying LLM provider. This obviously doesn't give you token-by-token streaming, which requires native support from the LLM provider, but ensures your code that expects an iterator of tokens can work for any of our LLM integrations.
- _Batch_ support defaults to calling the underlying LLM in parallel for each input. The concurrency can be controlled with the \`maxConcurrency\` key in \`RunnableConfig\`.
- _Map_ support defaults to calling \`.invoke\` across all instances of the array which it was called on.

Each LLM integration can optionally provide native implementations for invoke, streaming or batch, which, for providers that support it, can be more efficient. The table shows, for each integration, which features have been implemented with native support.
`;

const CHAT_MODEL_DOC_TEXT = `---
sidebar_position: 1
sidebar_class_name: hidden
---

# Chat models

## Features (natively supported)

All ChatModels implement the Runnable interface, which comes with default implementations of all methods, ie. \`invoke\`, \`batch\`, \`stream\`. This gives all ChatModels basic support for invoking, streaming and batching, which by default is implemented as below:

- _Streaming_ support defaults to returning an \`AsyncIterator\` of a single value, the final result returned by the underlying ChatModel provider. This obviously doesn't give you token-by-token streaming, which requires native support from the ChatModel provider, but ensures your code that expects an iterator of tokens can work for any of our ChatModel integrations.
- _Batch_ support defaults to calling the underlying ChatModel in parallel for each input. The concurrency can be controlled with the \`maxConcurrency\` key in \`RunnableConfig\`.
- _Map_ support defaults to calling \`.invoke\` across all instances of the array which it was called on.

Each ChatModel integration can optionally provide native implementations to truly enable invoke, streaming or batching requests. The table shows, for each integration, which features have been implemented with native support.
`;

const LLM_DOC_INDEX_PATH = "docs/docs/integrations/llms/index.mdx";
const CHAT_MODELS_DOC_INDEX_PATH = "docs/docs/integrations/chat/index.mdx";

/**
 * Fetch all files which are not .test.ts from a directory.
 */
const getAllTSFilesInDir = async (dir: string) => {
  const pattern = "**/!(*.test.ts)";
  const options = { nodir: true, cwd: dir };

  const globbered = await glob(pattern, options);
  return globbered;
};

/**
 * Verifies the class being passed is a class, and is a subclass of BaseChatModel.
 */
const isClass = (item: any) => {
  // Get the class name
  const className = item.name;

  // Check if the class name is in the ignore list
  if (LLM_IGNORE.includes(className)) {
    return false;
  }

  if (
    typeof item !== "function" ||
    !/^class\s/.test(Function.prototype.toString.call(item))
  ) {
    return false;
  }

  let prototype = Object.getPrototypeOf(item);
  while (prototype) {
    if (prototype === BaseChatModel) {
      return true;
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  return false;
};

const createTable = (
  data: {
    name: string;
    hasStreamImplemented: boolean;
    hasInvokeImplemented: boolean;
    hasBatchImplemented: boolean;
  }[]
) => {
  const header = `
| Model | Invoke | Stream | Batch |
| :--- | :---: | :---: | :---: |`;

  const rows = data.map((item) => {
    const r = `| ${item.name} | ${item.hasInvokeImplemented ? "✅" : "❌"} | ${
      item.hasStreamImplemented ? "✅" : "❌"
    } | ${item.hasBatchImplemented ? "✅" : "❌"} |`;
    return r;
  });

  return [header, ...rows].join("\n");
};

const checkClassMethods = async (directory: string, file: string) => {
  const fullFilePath = path.join(directory, file);
  const all = await import(fullFilePath);
  const classExports = Object.entries(all)
    .filter(([_, value]) => isClass(value))
    .map(([key, value]) => {
      const instance = value as typeof BaseChatModel;
      return {
        name: key,
        hasStreamImplemented: !!(
          instance.prototype._streamResponseChunks &&
          instance.prototype._streamResponseChunks !==
            BaseChatModel.prototype._streamResponseChunks
        ),
        hasInvokeImplemented: instance.prototype.invoke !== undefined,
        hasBatchImplemented: instance.prototype.batch !== undefined,
      };
    });
  return classExports;
};

async function main() {
  const CWD = process.cwd();
  const CHAT_MODEL_DIRECTORY = path.join(CWD, "langchain/src/chat_models");
  const LLM_DIRECTORY = path.join(CWD, "langchain/src/llms");

  const chatModelFiles = await getAllTSFilesInDir(CHAT_MODEL_DIRECTORY);
  const llmFiles = await getAllTSFilesInDir(LLM_DIRECTORY);

  const [chatClassCompatibility, llmClassCompatibility] = await Promise.all([
    Promise.all(
      chatModelFiles.map((file) =>
        checkClassMethods(CHAT_MODEL_DIRECTORY, file)
      )
    ),
    Promise.all(llmFiles.map((file) => checkClassMethods(LLM_DIRECTORY, file))),
  ]);

  const chatTable = createTable(chatClassCompatibility.flat());
  const fullChatModelFileContent = [CHAT_MODEL_DOC_TEXT, chatTable].join(
    "\n\n"
  );
  const llmTable = createTable(llmClassCompatibility.flat());
  const fullLLMFileContent = [LLM_DOC_TEXT, llmTable].join("\n\n");
  
  await Promise.all([
    await fs.writeFile(CHAT_MODELS_DOC_INDEX_PATH, fullChatModelFileContent),
    await fs.writeFile(LLM_DOC_INDEX_PATH, fullLLMFileContent),
  ]);
}
main();
