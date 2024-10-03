import { BaseMessageLike } from "../messages/base.js";
import { type BasePromptValueInterface } from "../prompt_values.js";

export type BaseLanguageModelInput =
  | BasePromptValueInterface
  | string
  | BaseMessageLike[];
