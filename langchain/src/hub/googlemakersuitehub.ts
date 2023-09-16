import { GooglePaLMTextInput } from "../llms/googlepalm.js";
import { GooglePaLMChatInput } from "../chat_models/googlepalm.js";
import { PromptTemplate } from "../prompts/index.js";

export interface MakerSuiteHubConfig {
  cacheTimeout: number,
}

export interface MakerSuitePromptVariable {
  variableId: string,
  displayName: string,
}

export interface MakerSuitePromptData {
  textPrompt: {
    value?: string,
    variables?: MakerSuitePromptVariable[],
  },
  runSettings?: GooglePaLMTextInput | GooglePaLMChatInput,
  // There may be other values we're not concerned about
}

export class MakerSuitePrompt {

  promptData: MakerSuitePromptData;

  constructor(promptData: MakerSuitePromptData) {
    this.promptData = promptData;
  }

  toTemplate(): PromptTemplate {
    const value = this.promptData?.textPrompt?.value ?? "";
    const promptString = value.replaceAll(/{{.*:(.+):.*}}/g, "{$1}");
    return PromptTemplate.fromTemplate(promptString);
  }

}

interface CacheEntry {
  updated: number,
  prompt: MakerSuitePrompt,
}

export class MakerSuiteHub {

  cache: Record<string, CacheEntry>;

  cacheTimeout: number;

  constructor(config?: MakerSuiteHubConfig){
    this.cacheTimeout = config?.cacheTimeout ?? 0;
  }

  isValid(entry: CacheEntry): boolean {
    // If we don't have a record, it can't be valid
    // And if the cache timeout is 0, we will always refresh, so the cache is invalid
    if (!entry || this.cacheTimeout === 0) {
      return false;
    }

    const now = Date.now();
    const expiration = entry.updated + this.cacheTimeout;
    return expiration < now;
  }

  async forceLoad(id: string): Promise<MakerSuitePrompt> {
    console.log('forceLoad', id);
    return new MakerSuitePrompt({
      textPrompt: {}
    });
  }

  async load(id: string): Promise<MakerSuitePrompt> {
    const entry = this.cache[id];
    const ret = this.isValid(entry) ? entry.prompt : await this.forceLoad(id);
    return ret;
  }

}