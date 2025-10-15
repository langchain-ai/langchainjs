import url from "node:url";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { load } from "../index.js";

const IMPORTANT_IMPORTS = JSON.parse(
  fs
    .readFileSync(
      path.join(
        path.dirname(url.fileURLToPath(import.meta.url)),
        "data",
        "important_imports.json"
      )
    )
    .toString()
);

const CURRENT_KNOWN_FAILURES = [
  "langchain/prompts/chat/BaseMessagePromptTemplate",
  "langchain/llms/openai/BaseOpenAI",
  "langchain/llms/openai/AzureOpenAI",
  "langchain/llms/vertexai/VertexAI",
  "langchain/llms/google_palm/GooglePalm",
  "langchain/chat_models/azure_openai/AzureChatOpenAI",
  "langchain/chat_models/google_palm/ChatGooglePalm",
  "langchain/chat_models/vertexai/ChatVertexAI",
  "langchain/prompts/few_shot_with_templates/FewShotPromptWithTemplates",
  "langchain/prompts/base/StringPromptTemplate",
  "langchain/prompts/chat/BaseStringMessagePromptTemplate",
  "langchain/prompts/chat/ChatPromptValue",
  "langchain/prompts/chat/ChatPromptValueConcrete",
  "langchain_core/agents/AgentAction",
  "langchain_core/agents/AgentFinish",
  "langchain_core/agents/AgentActionMessageLog",
  "langchain_core/outputs/chat_generation/ChatGeneration",
  "langchain_core/outputs/generation/Generation",
  "langchain_core/runnables/configurable/DynamicRunnable",
  "langchain_core/prompt_values/PromptValue",
  "langchain/llms/openai/BaseOpenAI",
  "langchain/llms/openai/AzureOpenAI",
  "langchain_core/prompts/few_shot_with_templates/FewShotPromptWithTemplates",
  "langchain_core/prompts/string/StringPromptTemplate",
  "langchain_core/prompts/chat/BaseStringMessagePromptTemplate",
  "langchain_core/prompt_values/ChatPromptValueConcrete",
  "langchain_core/runnables/base/RunnableBindingBase",
  "langchain_core/runnables/base/RunnableEachBase",
  "langchain_core/runnables/configurable/RunnableConfigurableAlternatives",
  "langchain_core/runnables/configurable/RunnableConfigurableFields",
  "@langchain/classic/output_parsers/list/CommaSeparatedListOutputParser",
];

const CROSS_LANGUAGE_ENTRYPOINTS = Object.keys(IMPORTANT_IMPORTS)
  .concat(Object.values(IMPORTANT_IMPORTS))
  .filter((v) => !CURRENT_KNOWN_FAILURES.includes(v));

describe("Test cross language serialization of important modules", () => {
  // https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/load/mapping.py
  test.each(CROSS_LANGUAGE_ENTRYPOINTS)(
    "Test matching serialization names for: %s",
    async (item) => {
      const idComponents = item.split("/");
      const mockItem = {
        lc: 1,
        type: "constructor",
        id: idComponents,
        kwargs: {},
      };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = (await load(JSON.stringify(mockItem))) as any;
        expect(result.constructor.name).toEqual(
          idComponents[idComponents.length - 1]
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        expect(e.message).not.toContain("Invalid identifer: $");
        expect(e.message).not.toContain("Invalid namespace: $");
      }
    }
  );
});
