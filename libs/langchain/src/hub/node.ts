import { Runnable } from "@langchain/core/runnables";
import {
  basePull,
  generateModelImportMap,
  generateOptionalImportMap,
  bindOutputSchema,
} from "./base.js";
import { load } from "../load/index.js";
import { getChatModelByClassName } from "../chat_models/universal.js";

export { basePush as push } from "./base.js";

function _idEquals(a: string[], b: string[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function isRunnableBinding(a: string[]): boolean {
  const wellKnownIds = [
    ["langchain_core", "runnables", "RunnableBinding"],
    ["langchain", "schema", "runnable", "RunnableBinding"],
  ];
  return wellKnownIds.some((id) => _idEquals(a, id));
}

/**
 * Pull a prompt from the hub.
 * @param ownerRepoCommit The name of the repo containing the prompt, as well as an optional commit hash separated by a slash.
 * @param options.apiKey LangSmith API key to use when pulling the prompt
 * @param options.apiUrl LangSmith API URL to use when pulling the prompt
 * @param options.includeModel Whether to also instantiate and attach a model instance to the prompt,
 *   if the prompt has associated model metadata. If set to true, invoking the resulting pulled prompt will
 *   also invoke the instantiated model. You must have the appropriate LangChain integration package installed.
 * @param options.modelClass If includeModel is true, the class of the model to instantiate. Required
 *   for non-OpenAI models. If you are running in Node or another environment that supports dynamic imports,
 *   you may instead import this function from "langchain/hub/node" and pass "includeModel: true" instead
 *   of specifying this parameter.
 * @param options.secrets A map of secrets to use when loading, e.g.
 *   {'OPENAI_API_KEY': 'sk-...'}`.
 *   If a secret is not found in the map, it will be loaded from the
 *   environment if `secrets_from_env` is `True`. Should only be needed when
 *   `includeModel` is `true`.
 * @param options.secretsFromEnv Whether to load secrets from environment variables.
 *   Use with caution and only with trusted prompts.
 * @returns
 */
export async function pull<T extends Runnable>(
  ownerRepoCommit: string,
  options?: {
    apiKey?: string;
    apiUrl?: string;
    includeModel?: boolean;
    secrets?: Record<string, string>;
    secretsFromEnv?: boolean;
  }
) {
  const promptObject = await basePull(ownerRepoCommit, options);
  let modelClass;
  if (options?.includeModel) {
    const chatModelObject = isRunnableBinding(
      promptObject.manifest.kwargs?.last?.id
    )
      ? promptObject.manifest.kwargs?.last?.kwargs?.bound
      : promptObject.manifest.kwargs?.last;

    if (Array.isArray(chatModelObject?.id)) {
      const modelName = chatModelObject?.id.at(-1);

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
    options?.secrets,
    generateOptionalImportMap(modelClass),
    generateModelImportMap(modelClass),
    options?.secretsFromEnv
  );
  return bindOutputSchema(loadedPrompt);
}
