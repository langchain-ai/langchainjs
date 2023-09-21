import { type TiktokenModel } from "js-tiktoken/lite";
import { encodingForModel } from "../util/tiktoken.js";

// https://www.npmjs.com/package/js-tiktoken

export const getModelNameForTiktoken = (modelName: string): TiktokenModel => {
  if (modelName.startsWith("gpt-3.5-turbo-16k")) {
    return "gpt-3.5-turbo-16k";
  }

  if (modelName.startsWith("gpt-3.5-turbo-")) {
    return "gpt-3.5-turbo";
  }

  if (modelName.startsWith("gpt-4-32k")) {
    return "gpt-4-32k";
  }

  if (modelName.startsWith("gpt-4-")) {
    return "gpt-4";
  }

  return modelName as TiktokenModel;
};

export const getEmbeddingContextSize = (modelName?: string): number => {
  switch (modelName) {
    case "text-embedding-ada-002":
      return 8191;
    default:
      return 2046;
  }
};

export const getModelContextSize = (modelName: string): number => {
  switch (getModelNameForTiktoken(modelName)) {
    case "gpt-3.5-turbo-16k":
      return 16384;
    case "gpt-3.5-turbo":
      return 4096;
    case "gpt-4-32k":
      return 32768;
    case "gpt-4":
      return 8192;
    case "text-davinci-003":
      return 4097;
    case "text-curie-001":
      return 2048;
    case "text-babbage-001":
      return 2048;
    case "text-ada-001":
      return 2048;
    case "code-davinci-002":
      return 8000;
    case "code-cushman-001":
      return 2048;
    default:
      return 4097;
  }
};

interface CalculateMaxTokenProps {
  prompt: string;
  modelName: TiktokenModel;
}

export const calculateMaxTokens = async ({
  prompt,
  modelName,
}: CalculateMaxTokenProps) => {
  let numTokens;

  try {
    numTokens = (
      await encodingForModel(getModelNameForTiktoken(modelName))
    ).encode(prompt).length;
  } catch (error) {
    console.warn(
      "Failed to calculate number of tokens, falling back to approximate count"
    );

    // fallback to approximate calculation if tiktoken is not available
    // each token is ~4 characters: https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them#
    numTokens = Math.ceil(prompt.length / 4);
  }

  const maxTokens = getModelContextSize(modelName);
  return maxTokens - numTokens;
};
