import { CallbackManager } from 'callbacks/base.js';
import { chunkArray } from "../util/chunk.js";
import { BaseLLM } from "./base.js";
import { calculateMaxTokens } from "../base_language/count_tokens.js";
import { LLMResult } from "../schema/index.js";
import type { TiktokenModel } from "@dqbd/tiktoken";

const promptToAzureArgs = ({
  prompt,
  temperature,
  stop,
  maxTokens,
}: {
  prompt: string[]
  temperature: number
  stop: string[] | string | undefined
  maxTokens: number
}): LLMPromptArgs => ({
    prompt,
    temperature,
    max_tokens: maxTokens,
    stop,
  });

export class AzureLLM extends BaseLLM {
  name = 'AzureLLM';

  batchSize = 20;

  temperature: number;

  concurrency?: number;

  key: string;

  endpoint: string;

  modelName: TiktokenModel;

  constructor(fields?: {
    callbackManager?: CallbackManager
    concurrency?: number
    cache?: boolean
    verbose?: boolean
    temperature?: number
    key?: string
    endpoint?: string,
    modelName?: TiktokenModel,
  }) {
    super({ ...fields });
    this.temperature = fields?.temperature === undefined ? 0.7 : fields?.temperature;

    const apiKey = process.env.AZURE_LLM_KEY || fields?.key;
    if (!apiKey) {
      throw new Error('Azure key not provided. Either set AZURE_LLM_KEY in your .env file or pass it in as a field to the constructor.');
    }
    this.key = apiKey;

    const endpoint = process.env.AZURE_LLM_ENDPOINT || fields?.endpoint;
    if (!endpoint) {
      throw new Error(
        'Azure endpoint not provided. Either set AZURE_LLM_ENDPOINT in your .env file or pass it in as a field to the constructor.'
      );
    }
    this.endpoint = endpoint;
    this.modelName = fields?.modelName || 'text-davinci-003';
  }

  async _generate(prompts: string[], stop?: string[] | undefined): Promise<LLMResult> {
    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: Choice[] = [];

    for (const element of subPrompts) {
      const prompts = element;
      const maxTokens = await calculateMaxTokens({
        prompt: prompts[0],
        modelName: this.modelName,
      });
      const args = promptToAzureArgs({ prompt: prompts, temperature: this.temperature, stop, maxTokens });

      const data = await this._callAzure(args);

      choices.push(...data.choices);
    }

    // *sigh* I have 1 for chunks just so it'll work like the example code
    const generations = chunkArray(choices, 1).map((promptChoices) =>
      promptChoices.map((choice) => ({
        text: choice.text ?? '',
        generationInfo: {
          finishReason: choice.finish_reason,
          logprobs: choice.logprobs,
        },
      }))
    );

    return {
      generations,
    };
  }

  private async _callAzure(args: LLMPromptArgs): Promise<LLMResponse> {
    const headers = { 'Content-Type': 'application/json', 'api-key': this.key };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Azure request failed', text);
      throw new Error(`Azure request failed with status ${response.status}`);
    }

    const json = await response.json();

    return json;
  }

  _llmType(): string {
    return this.name;
  }
}


      
// From Langchain

type LLMPromptArgs = {
  prompt: string[] | string
  max_tokens?: number
  temperature?: number
  top_p?: number
  n?: number
  stream?: boolean
  logprobs?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string[] | string
  best_of?: number
  logit_bias?: unknown
}

type Choice = {
  text: string
  index: number
  logprobs: unknown
  finish_reason: string
}

type LLMResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: Choice[]
}