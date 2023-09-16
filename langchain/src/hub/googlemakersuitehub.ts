import { protos } from "@google-ai/generativelanguage";

import { GooglePaLM } from "../llms/googlepalm.js";
import { ChatGooglePaLM } from "../chat_models/googlepalm.js";
import { PromptTemplate } from "../prompts/index.js";
import { BaseChatModel } from "../chat_models/base.js";
import { LLM } from "../llms/base.js";
import {Runnable} from "../schema/runnable/index.js";

export interface MakerSuiteHubConfig {
  cacheTimeout: number,
}

type MakerSuitePromptType = "text" | "data" | "chat";

export interface MakerSuitePromptVariable {
  variableId: string,
  displayName: string,
}

export interface MakerSuiteRunSettings {
  temperature?: number,
  model: string,
  candidateCount?: number,
  topP?: number,
  topK?: number,
  maxOutputTokens: number,
  safetySettings?: protos.google.ai.generativelanguage.v1beta2.ISafetySetting[],
}

export interface MakerSuiteTextPromptData {
  textPrompt: {
    value?: string,
    variables?: MakerSuitePromptVariable[],
  },
  runSettings?: MakerSuiteRunSettings,
  testExamples?: unknown,
}

export interface MakerSuiteDataPromptColumn {
  columnId: string,
  displayName: string,
  isInput?: boolean,
}

export interface MakerSuiteDataPromptRow {
  rowId: string,
  columnBindings: Record<string, string>,
}

export interface MakerSuiteDataPromptData {
  dataPrompt: {
    preamble: string,
    columns: MakerSuiteDataPromptColumn[],
    rows: MakerSuiteDataPromptRow[],
    rowsUsed: string[],
  },
  runSettings?: MakerSuiteRunSettings,
  testExamples?: unknown,
}

export interface MakerSuiteChatExchange {
  request?: string,
  response?: string,
  source: string,
  id: string,
}

export interface MakerSuiteChatPromptData {
  multiturnPrompt: {
    preamble: string,
    primingExchanges: MakerSuiteChatExchange[],
    sessions: {
      sessionExchanges: MakerSuiteChatExchange[]
    }[]
  },
  runSettings?: MakerSuiteRunSettings,
}

export type MakerSuitePromptData =
  MakerSuiteTextPromptData |
  MakerSuiteDataPromptData |
  MakerSuiteChatPromptData;

export class MakerSuitePrompt {

  promptType: MakerSuitePromptType;

  promptData: MakerSuitePromptData;

  constructor(promptData: MakerSuitePromptData) {
    this.promptData = promptData;
    this._determinePromptType();
  }

  _determinePromptType() {
    if (Object.hasOwn(this.promptData, "textPrompt")) {
      this.promptType = "text";

    } else if (Object.hasOwn(this.promptData, "dataPrompt")) {
      this.promptType = "data";

    } else if (Object.hasOwn(this.promptData, "multiturnPrompt")) {
      this.promptType = "chat";

    } else {
      const error = new Error("Unable to identify prompt type.");
      (error as any).promptData = this.promptData;
      throw error;
    }
  }

  _promptValueText(): string {
    return (this.promptData as MakerSuiteTextPromptData)?.textPrompt?.value ?? "";
  }

  _promptValueData(): string {
    return "FIXME";
  }

  _promptValueChat(): string {
    return "FIXME";
  }

  _promptValue(): string {
    switch (this.promptType) {
      case "text": return this._promptValueText();
      case "data": return this._promptValueData();
      case "chat": return this._promptValueChat();
      default: throw new Error(`Invalid promptType: ${this.promptType}`);
    }
  }

  toTemplate(): PromptTemplate {
    const value = this._promptValue();
    const promptString = value.replaceAll(/{{.*:(.+):.*}}/g, "{$1}");
    return PromptTemplate.fromTemplate(promptString);
  }

  toModel(): LLM | BaseChatModel {
    const modelName = this.promptData?.runSettings?.model || "models/text-bison-001";
    const modelSettings = {
      modelName,
      ...this.promptData?.runSettings
    }
    if (this.promptType === "chat") {
      return new ChatGooglePaLM(modelSettings);
    } else {
      return new GooglePaLM(modelSettings);
    }
  }

  toChain() {
    return this.toTemplate().pipe(this.toModel() as Runnable);
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