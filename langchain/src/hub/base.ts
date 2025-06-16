import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { Runnable } from "@langchain/core/runnables";
import { Client } from "langsmith";

/**
 * Push a prompt to the hub.
 * If the specified repo doesn't already exist, it will be created.
 * @param repoFullName The full name of the repo.
 * @param runnable The prompt to push.
 * @param options
 * @returns The URL of the newly pushed prompt in the hub.
 */
export async function basePush(
  repoFullName: string,
  runnable: Runnable,
  options?: {
    apiKey?: string;
    apiUrl?: string;
    parentCommitHash?: string;
    /** @deprecated Use isPublic instead. */
    newRepoIsPublic?: boolean;
    isPublic?: boolean;
    /** @deprecated Use description instead. */
    newRepoDescription?: string;
    description?: string;
    readme?: string;
    tags?: string[];
  }
) {
  const client = new Client(options);
  const payloadOptions = {
    object: runnable,
    parentCommitHash: options?.parentCommitHash,
    isPublic: options?.isPublic ?? options?.newRepoIsPublic,
    description: options?.description ?? options?.newRepoDescription,
    readme: options?.readme,
    tags: options?.tags,
  };
  return client.pushPrompt(repoFullName, payloadOptions);
}

export async function basePull(
  ownerRepoCommit: string,
  options?: { apiKey?: string; apiUrl?: string; includeModel?: boolean }
) {
  const client = new Client(options);

  const promptObject = await client.pullPromptCommit(ownerRepoCommit, {
    includeModel: options?.includeModel,
  });

  if (promptObject.manifest.kwargs?.metadata === undefined) {
    promptObject.manifest.kwargs = {
      ...promptObject.manifest.kwargs,
      metadata: {},
    };
  }

  promptObject.manifest.kwargs.metadata = {
    ...promptObject.manifest.kwargs.metadata,
    lc_hub_owner: promptObject.owner,
    lc_hub_repo: promptObject.repo,
    lc_hub_commit_hash: promptObject.commit_hash,
  };

  // Some nested mustache prompts have improperly parsed variables that include a dot.
  if (promptObject.manifest.kwargs.template_format === "mustache") {
    const stripDotNotation = (varName: string) => varName.split(".")[0];

    const { input_variables } = promptObject.manifest.kwargs;
    if (Array.isArray(input_variables)) {
      promptObject.manifest.kwargs.input_variables =
        input_variables.map(stripDotNotation);
    }

    const { messages } = promptObject.manifest.kwargs;
    if (Array.isArray(messages)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      promptObject.manifest.kwargs.messages = messages.map((message: any) => {
        const nestedVars = message?.kwargs?.prompt?.kwargs?.input_variables;
        if (Array.isArray(nestedVars)) {
          // eslint-disable-next-line no-param-reassign
          message.kwargs.prompt.kwargs.input_variables =
            nestedVars.map(stripDotNotation);
        }
        return message;
      });
    }
  }
  return promptObject;
}

export function generateModelImportMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelClass?: new (...args: any[]) => BaseLanguageModel
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelImportMap: Record<string, any> = {};
  if (modelClass !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelLcName = (modelClass as any)?.lc_name();
    let importMapKey;
    if (modelLcName === "ChatOpenAI") {
      importMapKey = "chat_models__openai";
    } else if (modelLcName === "ChatAnthropic") {
      importMapKey = "chat_models__anthropic";
    } else if (modelLcName === "ChatAzureOpenAI") {
      importMapKey = "chat_models__openai";
    } else if (modelLcName === "ChatVertexAI") {
      importMapKey = "chat_models__vertexai";
    } else if (modelLcName === "ChatGoogleGenerativeAI") {
      importMapKey = "chat_models__google_genai";
    } else if (modelLcName === "ChatBedrockConverse") {
      importMapKey = "chat_models__chat_bedrock_converse";
    } else if (modelLcName === "ChatMistral") {
      importMapKey = "chat_models__mistralai";
    } else if (modelLcName === "ChatFireworks") {
      importMapKey = "chat_models__fireworks";
    } else if (modelLcName === "ChatGroq") {
      importMapKey = "chat_models__groq";
    } else {
      throw new Error("Received unsupported model class when pulling prompt.");
    }
    modelImportMap[importMapKey] = {
      ...modelImportMap[importMapKey],
      [modelLcName]: modelClass,
    };
  }
  return modelImportMap;
}

export function generateOptionalImportMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelClass?: new (...args: any[]) => BaseLanguageModel
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optionalImportMap: Record<string, any> = {};
  if (modelClass !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelLcName = (modelClass as any)?.lc_name();
    let optionalImportMapKey;
    if (modelLcName === "ChatGoogleGenerativeAI") {
      optionalImportMapKey = "langchain_google_genai/chat_models";
    } else if (modelLcName === "ChatBedrockConverse") {
      optionalImportMapKey = "langchain_aws/chat_models";
    } else if (modelLcName === "ChatGroq") {
      optionalImportMapKey = "langchain_groq/chat_models";
    }
    if (optionalImportMapKey !== undefined) {
      optionalImportMap[optionalImportMapKey] = {
        [modelLcName]: modelClass,
      };
    }
  }
  return optionalImportMap;
}
