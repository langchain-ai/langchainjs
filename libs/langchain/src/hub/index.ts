import { Runnable } from "@langchain/core/runnables";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { load } from "../load/index.js";
import {
  basePush,
  basePull,
  generateModelImportMap,
  generateOptionalImportMap,
} from "./base.js";

export { basePush as push };

/**
 * Pull a prompt from the hub.
 *
 * @param ownerRepoCommit The name of the repo containing the prompt, as well as an optional commit hash separated by a slash.
 * @param options.apiKey LangSmith API key to use when pulling the prompt
 * @param options.apiUrl LangSmith API URL to use when pulling the prompt
 * @param options.includeModel Whether to also instantiate and attach a model instance to the prompt,
 *   if the prompt has associated model metadata. If set to true, invoking the resulting pulled prompt will
 *   also invoke the instantiated model. For non-OpenAI models, you must also set "modelClass" to the
 *   correct class of the model.
 * @param options.modelClass If includeModel is true, the class of the model to instantiate. Required
 *   for non-OpenAI models. If you are running in Node or another environment that supports dynamic imports,
 *   you may instead import this function from "langchain/hub/node" and pass "includeModel: true" instead
 *   of specifying this parameter.
 * @returns
 */
export async function pull<T extends Runnable>(
  ownerRepoCommit: string,
  options?: {
    apiKey?: string;
    apiUrl?: string;
    includeModel?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modelClass?: new (...args: any[]) => BaseLanguageModel;
  }
) {
  const promptObject = await basePull(ownerRepoCommit, options);
  try {
    const loadedPrompt = await load<T>(
      JSON.stringify(promptObject.manifest),
      undefined,
      generateOptionalImportMap(options?.modelClass),
      generateModelImportMap(options?.modelClass)
    );
    return loadedPrompt;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (options?.includeModel) {
      throw new Error(
        [
          e.message,
          "",
          `To load prompts with an associated non-OpenAI model, you must use the "langchain/hub/node" entrypoint, or pass a "modelClass" parameter like this:`,
          "",
          "```",
          `import { pull } from "langchain/hub";`,
          `import { ChatAnthropic } from "@langchain/anthropic";`,
          "",
          `const prompt = await pull("my-prompt", {`,
          `  includeModel: true,`,
          `  modelClass: ChatAnthropic,`,
          `});`,
          "```",
        ].join("\n")
      );
    } else {
      throw e;
    }
  }
}
