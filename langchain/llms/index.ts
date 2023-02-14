export { BaseLLM, LLM, SerializedLLM } from "./base";
export { OpenAI } from "./openai";
export { loadLLM } from "./load";

export type LLMCallbackManager = {
  handleStart: (
    llm: { name: string },
    prompts: string[],
    verbose?: boolean
  ) => void;
  handleError: (err: string, verbose?: boolean) => void;
  handleEnd: (output: LLMResult, verbose?: boolean) => void;
};

export type Generation = {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
};

export type LLMResult = {
  generations: Generation[][];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
};
