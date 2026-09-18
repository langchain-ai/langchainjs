import { addLangChainErrorFields } from "../errors/index.js";

export const MAX_PROMPT_TEMPLATE_DEPTH = 256;

export function createPromptTemplateDepthError() {
  return addLangChainErrorFields(
    new Error(
      `Prompt template nesting exceeds maximum depth (${MAX_PROMPT_TEMPLATE_DEPTH}).`
    ),
    "INVALID_PROMPT_INPUT"
  );
}
