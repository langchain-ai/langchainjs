import { TiktokenModel } from "js-tiktoken/lite";

// reexport this type from the included package so we can easily override and extend it if needed in the future
// also makes it easier for folks to import this type without digging around into the dependent packages
export type { TiktokenModel };
export type {
  OpenAIBaseInput,
  OpenAICoreRequestOptions,
  OpenAICallOptions,
  OpenAIInput,
  LegacyOpenAIInput,
  OpenAIChatInput,
  AzureOpenAIInput,
} from "@langchain/openai";
