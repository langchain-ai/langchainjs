import { Runnable } from "@langchain/core/runnables";
import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import { load } from "../load/index.js";
import { basePush, basePull, generateModelImportMap } from "./base.js";

export { basePush as push };

/**
 * Pull a prompt from the hub.
 * NOTE: If you are in a Node environment and want to include an instantiated model with your pulled prompt,
 * you can instead import this function from "langchain/hub/node" and pass "includeModel: true".
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modelClass?: new (...args: any[]) => BaseLanguageModel;
  }
) {
  const promptObject = await basePull(ownerRepoCommit, options);
  try {
    const loadedPrompt = await load<T>(
      JSON.stringify(promptObject.manifest),
      undefined,
      undefined,
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
