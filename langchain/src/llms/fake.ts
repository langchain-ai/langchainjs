import { setTimeout } from 'timers/promises';
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { LLM, BaseLLMParams } from "./base.js";
import { GenerationChunk } from "../schema/index.js";

/**
 * Interface for the input parameters specific to the Fake List model.
 */
export interface FakeListInput extends BaseLLMParams {
  /** Responses to return */
  responses: string[];
}

/**
 * A fake LLM that returns a predefined list of responses. It can be used for
 * testing purposes.
 */
export class FakeListLLM extends LLM {
  static lc_name() {
    return "Fake List";
  }

  responses: string[];

  i = 0;

  constructor({ responses }: FakeListInput) {
    super({});
    this.responses = responses;
  }

  _llmType() {
    return "fake-list";
  }

  async _call(
    _prompt: string,
    _options: this["ParsedCallOptions"],
  ): Promise<string> {
    const response = this.responses[this.i];
    
    this._incrementResponse();
    return response;
  }

  _currentResponse() {
    return this.responses[this.i];
  }

  _incrementResponse() {
    if (this.i < this.responses.length - 1) {
      this.i += 1;
    } else {
      this.i = 0;
    }
  }
}

/**
 * Interface for the input parameters specific to the Fake List Streaming model.
 */
export interface FakeListStreamingInput extends FakeListInput {
  /** Time to sleep in milliseconds between responses */
  sleep?: number;
}

/**
 * A fake LLM that streams a predefined list of responses. It can be used for
 * testing purposes.
 */
export class FakeListStreamingLLM extends FakeListLLM {
  sleep?: number;

  constructor({ responses, sleep }: FakeListStreamingInput) {
    super({ responses });
    this.sleep = sleep;
  }

  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
  ): Promise<string> {
    const chunks: string[] = [];

    for await (const chunk of this._streamResponseChunks(prompt, options)) {
      chunks.push(chunk.text);
    }
    
    this._incrementResponse();
    return chunks.join("");
  }

  async *_streamResponseChunks(
    _input: string,
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const response = this._currentResponse();

    for await (const text of response) {
      if (this.sleep !== undefined) {
        await setTimeout(this.sleep);
      }

      yield this._createResponseChunk(text);
    }
  }

  _createResponseChunk(text: string): GenerationChunk {
    return new GenerationChunk({
      text,
      generationInfo: {}
    });
  }
}
