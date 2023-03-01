import {
  encoding_for_model, TiktokenModel
} from "@dqbd/tiktoken";

// https://www.npmjs.com/package/@dqbd/tiktoken

export const getModelContextSize = (modelName: TiktokenModel): number => {
  switch (modelName) {
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

type CalculateMaxTokenProps = {
  prompt: string;
  modelName: TiktokenModel;
};

export const calculateMaxTokens = ({
  prompt,
  modelName,
}: CalculateMaxTokenProps) => {
  const encoding = encoding_for_model(modelName);

  const tokenized = encoding.encode(prompt);

  const numTokens = tokenized.length;

  const maxTokens = getModelContextSize(modelName);

  return maxTokens - numTokens;
};
