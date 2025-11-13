import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import { BaseLLMParams, LLM } from "../../language_models/llms.js";
import { GenerationChunk } from "../../outputs.js";

export class FakeLLM extends LLM {
  response?: string;

  thrownErrorString?: string;

  constructor(
    fields: { response?: string; thrownErrorString?: string } & BaseLLMParams
  ) {
    super(fields);
    this.response = fields.response;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(
    prompt: string,
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    const response = this.response ?? prompt;
    await runManager?.handleLLMNewToken(response);
    return response;
  }
}

export class FakeStreamingLLM extends LLM {
  sleep?: number = 50;

  responses?: string[];

  thrownErrorString?: string;

  constructor(
    fields: {
      sleep?: number;
      responses?: string[];
      thrownErrorString?: string;
    } & BaseLLMParams
  ) {
    super(fields);
    this.sleep = fields.sleep ?? this.sleep;
    this.responses = fields.responses;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    const response = this.responses?.[0];
    this.responses = this.responses?.slice(1);
    return response ?? prompt;
  }

  async *_streamResponseChunks(
    input: string,
    _options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ) {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    const response = this.responses?.[0];
    this.responses = this.responses?.slice(1);
    for (const c of response ?? input) {
      await new Promise((resolve) => setTimeout(resolve, this.sleep));
      yield { text: c, generationInfo: {} } as GenerationChunk;
      await runManager?.handleLLMNewToken(c);
    }
  }
}
