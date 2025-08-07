import {
  patchConfig,
  pickRunnableConfigKeys,
  RunnableFunc,
} from "@langchain/core/runnables";
import { AsyncLocalStorageProviderSingleton } from "@langchain/core/singletons";
import { DynamicTool, ToolRunnableConfig } from "@langchain/core/tools";
import OpenAI from "openai";
import { ChatOpenAIToolType } from "../utils/tools.js";
import { OpenAIClient } from "../index.js";

export type CustomToolFields = Omit<OpenAI.Responses.CustomTool, "type">;

type LangchainCustomTool = DynamicTool<string> & {
  metadata: {
    customTool: OpenAI.Responses.CustomTool;
  };
};

export function customTool(
  func: RunnableFunc<string, string, ToolRunnableConfig>,
  fields: CustomToolFields
): DynamicTool<string> {
  return new DynamicTool({
    ...fields,
    description: "",
    metadata: {
      customTool: fields,
    },
    func: async (input, runManager, config) =>
      new Promise<string>((resolve, reject) => {
        const childConfig = patchConfig(config, {
          callbacks: runManager?.getChild(),
        });
        void AsyncLocalStorageProviderSingleton.runWithConfig(
          pickRunnableConfigKeys(childConfig),
          async () => {
            try {
              resolve(func(input, childConfig));
            } catch (e) {
              reject(e);
            }
          }
        );
      }),
  });
}

export function isCustomTool(tool: unknown): tool is LangchainCustomTool {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "metadata" in tool &&
    typeof tool.metadata === "object" &&
    tool.metadata !== null &&
    "customTool" in tool.metadata &&
    typeof tool.metadata.customTool === "object" &&
    tool.metadata.customTool !== null
  );
}

export function isOpenAICustomTool(
  tool: ChatOpenAIToolType
): tool is OpenAIClient.Chat.ChatCompletionCustomTool {
  return (
    "type" in tool &&
    tool.type === "custom" &&
    "custom" in tool &&
    typeof tool.custom === "object" &&
    tool.custom !== null
  );
}
