import type { AIMessage, AIMessageChunk } from "../ai.js";
import type { ContentBlock } from "../content/index.js";

import { anthropicTranslator } from "./anthropic.js";
import { openaiTranslator } from "./openai.js";

export interface StandardContentBlockTranslator {
  translateContent(message: AIMessage): Array<ContentBlock.Standard>;
  translateContentChunk(chunk: AIMessageChunk): Array<ContentBlock.Standard>;
}

type TranslatorRegistry = Map<string, StandardContentBlockTranslator>;

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var lc_block_translators_registry: TranslatorRegistry;
}

globalThis.lc_block_translators_registry ??= new Map([
  ["anthropic", anthropicTranslator],
  ["openai", openaiTranslator],
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
