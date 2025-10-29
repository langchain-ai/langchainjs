import { defineConfig } from "tsdown";
import {
  getBuildConfig,
  importConstantsPlugin,
  importMapPlugin,
  lcSecretsPlugin,
} from "@langchain/build";

export default defineConfig([
  getBuildConfig({
    plugins: [
      lcSecretsPlugin({
        enabled: process.env.SKIP_SECRET_SCANNING !== "true",
        strict: process.env.NODE_ENV === "production",
      }),
      importConstantsPlugin({
        enabled: process.env.SKIP_IMPORT_CONSTANTS !== "true",
        optionalEntrypoints: [
          "chat_models/universal",
          "cache/file_system",
          "storage/file_system",
          "hub",
          "hub/node",
        ],
      }),
      importMapPlugin({
        enabled: process.env.SKIP_IMPORT_MAP !== "true",
        extraImportMapEntries: [
          {
            modules: ["PromptTemplate"],
            alias: ["prompts", "prompt"],
            path: "@langchain/core/prompts",
          },
          {
            modules: [
              "AIMessage",
              "AIMessageChunk",
              "BaseMessage",
              "BaseMessageChunk",
              "ChatMessage",
              "ChatMessageChunk",
              "FunctionMessage",
              "FunctionMessageChunk",
              "HumanMessage",
              "HumanMessageChunk",
              "SystemMessage",
              "SystemMessageChunk",
              "ToolMessage",
              "ToolMessageChunk",
            ],
            alias: ["schema", "messages"],
            path: "@langchain/core/messages",
          },
          {
            modules: [
              "AIMessage",
              "AIMessageChunk",
              "BaseMessage",
              "BaseMessageChunk",
              "ChatMessage",
              "ChatMessageChunk",
              "FunctionMessage",
              "FunctionMessageChunk",
              "HumanMessage",
              "HumanMessageChunk",
              "SystemMessage",
              "SystemMessageChunk",
              "ToolMessage",
              "ToolMessageChunk",
            ],
            alias: ["schema"],
            path: "@langchain/core/messages",
          },
          {
            modules: [
              "AIMessagePromptTemplate",
              "ChatMessagePromptTemplate",
              "ChatPromptTemplate",
              "HumanMessagePromptTemplate",
              "MessagesPlaceholder",
              "SystemMessagePromptTemplate",
            ],
            alias: ["prompts", "chat"],
            path: "@langchain/core/prompts",
          },
          {
            modules: ["ImagePromptTemplate"],
            alias: ["prompts", "image"],
            path: "@langchain/core/prompts",
          },
          {
            modules: ["PipelinePromptTemplate"],
            alias: ["prompts", "pipeline"],
            path: "@langchain/core/prompts",
          },
          {
            modules: ["StringPromptValue"],
            alias: ["prompts", "base"],
            path: "@langchain/core/prompt_values",
          },
          {
            modules: [
              "RouterRunnable",
              "RunnableAssign",
              "RunnableBinding",
              "RunnableBranch",
              "RunnableEach",
              "RunnableMap",
              "RunnableParallel",
              "RunnablePassthrough",
              "RunnablePick",
              "RunnableRetry",
              "RunnableSequence",
              "RunnableWithFallbacks",
              "RunnableWithMessageHistory",
            ],
            alias: ["schema", "runnable"],
            path: "@langchain/core/runnables",
          },
          {
            modules: ["ChatGenerationChunk", "GenerationChunk"],
            alias: ["schema", "output"],
            path: "@langchain/core/outputs",
          },
        ],
        deprecatedOmitFromImportMap: ["hub", "hub/node"],
      }),
    ],
  }),
]);
