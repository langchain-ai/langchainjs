import { Runnable } from "@langchain/core/runnables";
import {
  basePull,
  generateModelImportMap,
  generateOptionalImportMap,
  bindOutputSchema,
} from "./base.js";
import { load } from "../load/index.js";
import { getChatModelByClassName } from "../chat_models/universal.js";

// TODO: Make this the default, add web entrypoint in next breaking release

export { basePush as push } from "./base.js";

/**
 * Pull a prompt from the hub.
 * @param ownerRepoCommit The name of the repo containing the prompt, as well as an optional commit hash separated by a slash.
 * @param options.apiKey LangSmith API key to use when pulling the prompt
 * @param options.apiUrl LangSmith API URL to use when pulling the prompt
 * @param options.includeModel Whether to also instantiate and attach a model instance to the prompt,
 *   if the prompt has associated model metadata. If set to true, invoking the resulting pulled prompt will
 *   also invoke the instantiated model. You must have the appropriate LangChain integration package installed.
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

      if (modelName) {
        modelClass = await getChatModelByClassName(modelName);
        if (!modelClass) {
          console.warn(
            `Received unknown model name from prompt hub: "${modelName}"`
          );
        }
      }
    }
  }
  const loadedPrompt = await load<T>(
    JSON.stringify(promptObject.manifest),
    undefined,
    generateOptionalImportMap(modelClass),
    generateModelImportMap(modelClass)
  );
  return bindOutputSchema(loadedPrompt);
}
