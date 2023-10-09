import type { protos } from "@google-ai/generativelanguage";
import type { google } from "@google-ai/generativelanguage/build/protos/protos.js";
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";

import { GooglePaLM } from "../../../llms/googlepalm.js";
import { ChatGooglePaLM } from "../../../chat_models/googlepalm.js";
import { PromptTemplate } from "../../../prompts/index.js";
import { BaseLanguageModel } from "../../../base_language/index.js";
import { Runnable } from "../../../schema/runnable/index.js";
import {
  AsyncCaller,
  AsyncCallerCallOptions,
} from "../../../util/async_caller.js";
import {
  GoogleResponse,
  GoogleVertexAIConnectionParams,
} from "../../../types/googlevertexai-types.js";
import { GoogleConnection } from "../../../util/googlevertexai-connection.js";

/**
 * Configuration that allows us to load or pull a prompt that has been created
 * by the Google MakerSuite site and saved in Google Drive.
 *
 * There is a simple in-memory cache of these prompts that is refreshed
 * after the cacheTimeout specified in the configuration.
 */
export interface MakerSuiteHubConfig {
  /**
   * How long, in milliseconds, before a prompt is assumed stale and should
   * be refreshed from the copy in Google Drive.
   */
  cacheTimeout: number;

  caller?: AsyncCaller;
}

type MakerSuitePromptType = "text" | "data" | "chat";

export interface MakerSuitePromptVariable {
  variableId: string;
  displayName: string;
}

export interface MakerSuiteRunSettings {
  temperature?: number;
  model: string;
  candidateCount?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens: number;
  safetySettings?: protos.google.ai.generativelanguage.v1beta2.ISafetySetting[];
}

export interface MakerSuiteTextPromptData {
  textPrompt: {
    value?: string;
    variables?: MakerSuitePromptVariable[];
  };
  runSettings?: MakerSuiteRunSettings;
  testExamples?: unknown;
}

export interface MakerSuiteDataPromptColumn {
  columnId: string;
  displayName: string;
  isInput?: boolean;
}

export interface MakerSuiteDataPromptRow {
  rowId: string;
  columnBindings: Record<string, string>;
}

export interface MakerSuiteDataPromptData {
  dataPrompt: {
    preamble: string;
    columns: MakerSuiteDataPromptColumn[];
    rows: MakerSuiteDataPromptRow[];
    rowsUsed: string[];
  };
  runSettings?: MakerSuiteRunSettings;
  testExamples?: unknown;
}

export interface MakerSuiteChatExchange {
  request?: string;
  response?: string;
  source: string;
  id: string;
}

export interface MakerSuiteChatPromptData {
  multiturnPrompt: {
    preamble: string;
    primingExchanges: MakerSuiteChatExchange[];
    sessions: {
      sessionExchanges: MakerSuiteChatExchange[];
    }[];
  };
  runSettings?: MakerSuiteRunSettings;
}

/**
 * These are the possible formats that the JSON generated by MakerSuite
 * and saved in Google Drive can be.
 */
export type MakerSuitePromptData =
  | MakerSuiteTextPromptData
  | MakerSuiteDataPromptData
  | MakerSuiteChatPromptData;

/**
 * A class that represents the Prompt that has been created by MakerSuite
 * and loaded from Google Drive. It exposes methods to turn this prompt
 * into a Template, a Model, and into a chain consisting of these two elements.
 * In general, this class should be created by the MakerSuiteHub class and
 * not instantiated manually.
 */
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).promptData = this.promptData;
      throw error;
    }
  }

  _promptValueText(): string {
    return (
      (this.promptData as MakerSuiteTextPromptData)?.textPrompt?.value ?? ""
    );
  }

  _promptValueData(): string {
    const promptData: MakerSuiteDataPromptData = this
      .promptData as MakerSuiteDataPromptData;
    const dataPrompt = promptData?.dataPrompt;
    let prompt = `${dataPrompt?.preamble}\n` || "";

    dataPrompt?.rows.forEach((row) => {
      // Add the data for each row, as long as it is listed as used
      if (dataPrompt?.rowsUsed.includes(row.rowId)) {
        // Add each input column
        dataPrompt?.columns.forEach((column) => {
          if (column.isInput) {
            prompt += `${column.displayName} ${
              row.columnBindings[column.columnId]
            }\n`;
          }
        });

        // Add each output column
        dataPrompt?.columns.forEach((column) => {
          if (!column.isInput) {
            prompt += `${column.displayName} ${
              row.columnBindings[column.columnId]
            }\n`;
          }
        });
      }
    });

    // Add the input column prompts
    dataPrompt?.columns.forEach((column) => {
      if (column.isInput) {
        prompt += `${column.displayName} {${column.displayName.replace(
          ":",
          ""
        )}}\n`;
      }
    });

    // Add just the first output column
    const firstOutput = dataPrompt?.columns.find((column) => !column.isInput);
    prompt += `${firstOutput?.displayName} `;

    return prompt;
  }

  _promptValueChat(): string {
    return (
      (this.promptData as MakerSuiteChatPromptData)?.multiturnPrompt
        ?.preamble ?? ""
    );
  }

  _promptValue(): string {
    switch (this.promptType) {
      case "text":
        return this._promptValueText();
      case "data":
        return this._promptValueData();
      case "chat":
        return this._promptValueChat();
      default:
        throw new Error(`Invalid promptType: ${this.promptType}`);
    }
  }

  /**
   * Create a template from the prompt, including any "test input" specified
   * in MakerSuite as a template parameter.
   */
  toTemplate(): PromptTemplate {
    const value = this._promptValue();
    const promptString = value.replaceAll(/{{.*:(.+):.*}}/g, "{$1}");
    return PromptTemplate.fromTemplate(promptString);
  }

  _modelName(): string {
    let ret = this.promptData?.runSettings?.model;
    if (!ret) {
      ret =
        this.promptType === "chat"
          ? "models/chat-bison-001"
          : "models/text-bison-001";
    }
    return ret;
  }

  _examples(): google.ai.generativelanguage.v1beta2.IExample[] {
    const promptData: MakerSuiteChatPromptData = this
      .promptData as MakerSuiteChatPromptData;
    const ret: google.ai.generativelanguage.v1beta2.IExample[] =
      promptData?.multiturnPrompt?.primingExchanges
        .map((exchange) => {
          const example: google.ai.generativelanguage.v1beta2.IExample = {};
          if (exchange?.request) {
            example.input = {
              content: exchange.request,
            };
          }
          if (exchange?.response) {
            example.output = {
              content: exchange.response,
            };
          }
          return example;
        })
        .filter((value) => Object.keys(value).length);
    return ret;
  }

  /**
   * Create a model from the prompt with all the parameters (model name,
   * temperature, etc) set as they were in MakerSuite.
   */
  toModel(): BaseLanguageModel {
    const modelName = this._modelName();
    const modelSettings = {
      modelName,
      ...this.promptData?.runSettings,
    };
    if (this.promptType === "chat") {
      const examples = this._examples();
      return new ChatGooglePaLM({
        examples,
        ...modelSettings,
      });
    } else {
      return new GooglePaLM(modelSettings);
    }
  }

  /**
   * Create a RunnableSequence based on the template and model that can
   * be created from this prompt. The template will have parameters available
   * based on the "test input" that was set in MakerSuite, and the model
   * will have the parameters (model name, temperature, etc) from those in
   * MakerSuite.
   */
  toChain() {
    return this.toTemplate().pipe(this.toModel() as Runnable);
  }
}

interface DriveFileReadParams
  extends GoogleVertexAIConnectionParams<GoogleAuthOptions> {
  fileId: string;
}

interface DriveCallOptions extends AsyncCallerCallOptions {
  // Empty, I think
}

interface DriveFileMakerSuiteResponse extends GoogleResponse {
  data: MakerSuitePromptData;
}

export class DriveFileReadConnection
  extends GoogleConnection<DriveCallOptions, DriveFileMakerSuiteResponse>
  implements DriveFileReadParams
{
  endpoint: string;

  apiVersion: string;

  fileId: string;

  constructor(fields: DriveFileReadParams, caller: AsyncCaller) {
    super(
      caller,
      new GoogleAuth({
        scopes: "https://www.googleapis.com/auth/drive.readonly",
        ...fields.authOptions,
      })
    );

    this.endpoint = fields.endpoint ?? "www.googleapis.com";
    this.apiVersion = fields.apiVersion ?? "v3";

    this.fileId = fields.fileId;
  }

  async buildUrl(): Promise<string> {
    return `https://${this.endpoint}/drive/${this.apiVersion}/files/${this.fileId}?alt=media`;
  }

  buildMethod(): string {
    return "GET";
  }

  async request(
    options?: DriveCallOptions
  ): Promise<DriveFileMakerSuiteResponse> {
    return this._request(undefined, options ?? {});
  }
}

export interface CacheEntry {
  updated: number;
  prompt: MakerSuitePrompt;
}

/**
 * A class allowing access to MakerSuite prompts that have been saved in
 * Google Drive.
 * MakerSuite prompts are pulled based on their Google Drive ID (which is available
 * from Google Drive or as part of the URL when the prompt is open in MakerSuite).
 * There is a basic cache that will store the prompt in memory for a time specified
 * in milliseconds. This defaults to 0, indicating the prompt should always be
 * pulled from Google Drive.
 */
export class MakerSuiteHub {
  cache: Record<string, CacheEntry> = {};

  cacheTimeout: number;

  caller: AsyncCaller;

  constructor(config?: MakerSuiteHubConfig) {
    this.cacheTimeout = config?.cacheTimeout ?? 0;
    this.caller = config?.caller ?? new AsyncCaller({});
  }

  /**
   * Is the current cache entry valid, or does it need to be refreshed.
   * It will need to be refreshed under any of the following conditions:
   * - It does not currently exist in the cache
   * - The cacheTimeout is 0
   * - The cache was last updated longer ago than the cacheTimeout allows
   * @param entry - The cache entry, including when this prompt was last refreshed
   */
  isValid(entry: CacheEntry): boolean {
    // If we don't have a record, it can't be valid
    // And if the cache timeout is 0, we will always refresh, so the cache is invalid
    if (!entry || this.cacheTimeout === 0) {
      return false;
    }

    const now = Date.now();
    const expiration = entry.updated + this.cacheTimeout;
    return expiration > now;
  }

  /**
   * Get a MakerSuitePrompt that is specified by the Google Drive ID.
   * This will always be loaded from Google Drive.
   * @param id
   * @return A MakerSuitePrompt which can be used to create a template, model, or chain.
   */
  async forcePull(id: string): Promise<MakerSuitePrompt> {
    const fields: DriveFileReadParams = {
      fileId: id,
    };
    const connection = new DriveFileReadConnection(fields, this.caller);
    const result = await connection.request();
    const ret = new MakerSuitePrompt(result.data);
    this.cache[id] = {
      prompt: ret,
      updated: Date.now(),
    };
    return ret;
  }

  /**
   * Get a MakerSuitePrompt that is specified by the Google Drive ID. This may be
   * loaded from Google Drive or, if there is a valid copy in the cache, the cached
   * copy will be returned.
   * @param id
   * @return A MakerSuitePrompt which can be used to create a template, model, or chain.
   */
  async pull(id: string): Promise<MakerSuitePrompt> {
    const entry = this.cache[id];
    const ret = this.isValid(entry) ? entry.prompt : await this.forcePull(id);
    return ret;
  }
}
