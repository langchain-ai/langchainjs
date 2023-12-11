import { test } from "@jest/globals";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import * as path from "node:path";

import { load } from "../index.js";

const IMPORTANT_IMPORTS = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "data",
      "important_imports.json"
    )
  ).toString()
);

const CURRENT_KNOWN_FAILURES = [
  "langchain/schema/agent/AgentAction",
  "langchain/schema/agent/AgentFinish",
  "langchain/schema/prompt_template/BasePromptTemplate",
  "langchain/schema/agent/AgentActionMessageLog",
  "langchain/schema/agent/OpenAIToolAgentAction",
  "langchain/prompts/chat/BaseMessagePromptTemplate",
  "langchain/schema/output/ChatGeneration",
  "langchain/schema/output/Generation",
  "langchain/schema/document/Document",
  "langchain/schema/runnable/DynamicRunnable",
  "langchain/schema/prompt/PromptValue",
  "langchain/llms/openai/BaseOpenAI",
  "langchain/llms/openai/AzureOpenAI",
  "langchain/schema/prompt_template/BaseChatPromptTemplate",
  "langchain/prompts/few_shot_with_templates/FewShotPromptWithTemplates",
  "langchain/prompts/base/StringPromptTemplate",
  "langchain/prompts/chat/BaseStringMessagePromptTemplate",
  "langchain/prompts/chat/ChatPromptValue",
  "langchain/prompts/chat/ChatPromptValueConcrete",
  "langchain/schema/runnable/HubRunnable",
  "langchain/schema/runnable/RunnableBindingBase",
  "langchain/schema/runnable/OpenAIFunctionsRouter",
  "langchain/schema/runnable/RunnableEachBase",
  "langchain/schema/runnable/RunnableConfigurableAlternatives",
  "langchain/schema/runnable/RunnableConfigurableFields",
  "langchain_core/agents/AgentAction",
  "langchain_core/agents/AgentFinish",
  "langchain_core/agents/AgentActionMessageLog",
  "langchain/agents/output_parsers/openai_tools/OpenAIToolAgentAction",
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
  "langchain/runnables/hub/HubRunnable",
  "langchain_core/runnables/base/RunnableBindingBase",
  "langchain/runnables/openai_functions/OpenAIFunctionsRouter",
  "langchain_core/runnables/base/RunnableEachBase",
  "langchain_core/runnables/configurable/RunnableConfigurableAlternatives",
  "langchain_core/runnables/configurable/RunnableConfigurableFields",
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
      }
    }
  );
});
