import type { AIMessage, AIMessageChunk } from "../ai.js";
import type { ContentBlock } from "../content/index.js";

import { ChatAnthropicTranslator } from "./anthropic.js";
import { ChatBedrockConverseTranslator } from "./bedrock_converse.js";
import { ChatDeepSeekTranslator } from "./deepseek.js";
import { ChatGoogleGenAITranslator } from "./google_genai.js";
import { ChatVertexTranslator } from "./google_vertexai.js";
import { ChatGroqTranslator } from "./groq.js";
import { ChatOllamaTranslator } from "./ollama.js";
import { ChatOpenAITranslator } from "./openai.js";
import { ChatXAITranslator } from "./xai.js";
import { ChatGoogleTranslator } from "./google.js";

export interface StandardContentBlockTranslator {
  translateContent(message: AIMessage): Array<ContentBlock.Standard>;
  translateContentChunk(chunk: AIMessageChunk): Array<ContentBlock.Standard>;
}

type TranslatorRegistry = Map<string, StandardContentBlockTranslator>;

declare global {
  var lc_block_translators_registry: TranslatorRegistry;
}

globalThis.lc_block_translators_registry ??= new Map([
  ["anthropic", ChatAnthropicTranslator],
  ["bedrock-converse", ChatBedrockConverseTranslator],
  ["deepseek", ChatDeepSeekTranslator],
  ["google", ChatGoogleTranslator],
  ["google-genai", ChatGoogleGenAITranslator],
  ["google-vertexai", ChatVertexTranslator],
  ["groq", ChatGroqTranslator],
  ["ollama", ChatOllamaTranslator],
  ["openai", ChatOpenAITranslator],
  ["xai", ChatXAITranslator],
]);

export function registerTranslator(
  modelProvider: string,
  translator: StandardContentBlockTranslator
) {
  globalThis.lc_block_translators_registry.set(modelProvider, translator);
}

export function getTranslator(
  modelProvider: string
): StandardContentBlockTranslator | undefined {
  return globalThis.lc_block_translators_registry.get(modelProvider);
}
