import { Runnable } from "@langchain/core/runnables";
import { basePush, basePull, generateModelImportMap } from "./base.js";
import { load } from "../load/index.js";

export { basePush as push };

/**
 * Pull a prompt from the hub.
 * @param ownerRepoCommit The name of the repo containing the prompt, as well as an optional commit hash separated by a slash.
 * @param options
 * @returns
 */
export async function pull<T extends Runnable>(
  ownerRepoCommit: string,
  options?: {
    apiKey?: string;
    apiUrl?: string;
    includeModel?: boolean;
  }
) {
  const promptObject = await basePull(ownerRepoCommit, options);
  let modelClass;
  if (options?.includeModel) {
    if (Array.isArray(promptObject.manifest.kwargs?.last?.kwargs?.bound?.id)) {
      const modelName =
        promptObject.manifest.kwargs?.last?.kwargs?.bound?.id.at(-1);
      if (modelName === "ChatAnthropic") {
        modelClass = (await import("@langchain/anthropic")).ChatAnthropic;
      } else if (modelName === "ChatAzureOpenAI") {
        modelClass = (await import("@langchain/openai")).AzureChatOpenAI;
      } else if (modelName === "ChatGoogleVertexAI") {
        modelClass = (await import("@langchain/google-vertexai")).ChatVertexAI;
      } else if (modelName === "ChatGoogleGenerativeAI") {
        modelClass = (await import("@langchain/google-genai"))
          .ChatGoogleGenerativeAI;
      } else if (modelName === "ChatBedrockConverse") {
        modelClass = (await import("@langchain/aws")).ChatBedrockConverse;
      } else if (modelName === "ChatMistral") {
        modelClass = (await import("@langchain/mistralai")).ChatMistralAI;
      } else if (modelName === "ChatGroq") {
        modelClass = (await import("@langchain/groq")).ChatGroq;
      } else if (modelName !== undefined) {
        console.warn(
          `Received unknown model name from prompt hub: "${modelName}"`
        );
      }
    }
  }
  const loadedPrompt = await load<T>(
    JSON.stringify(promptObject.manifest),
    undefined,
    undefined,
    generateModelImportMap(modelClass)
  );
  return loadedPrompt;
}
