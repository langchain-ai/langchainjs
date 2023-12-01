/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseCallbackConfig } from "../../callbacks/manager.js";
import { Document } from "../../documents/document.js";
import { BaseChatModel } from "../../language_models/chat_models.js";
import { LLM } from "../../language_models/llms.js";
import { BaseMessage, AIMessage } from "../../messages/index.js";
import { BaseOutputParser } from "../../output_parsers/base.js";
import { GenerationChunk, type ChatResult } from "../../outputs.js";
import { BaseRetriever } from "../../retrievers.js";
import { Runnable } from "../../runnables/base.js";

/**
 * Parser for comma-separated values. It splits the input text by commas
 * and trims the resulting values.
 */
export class FakeSplitIntoListParser extends BaseOutputParser<string[]> {
  lc_namespace = ["tests", "fake"];

  getFormatInstructions() {
    return "";
  }

  async parse(text: string): Promise<string[]> {
    return text.split(",").map((value) => value.trim());
  }
}

export class FakeRunnable extends Runnable<string, Record<string, any>> {
  lc_namespace = ["tests", "fake"];

  returnOptions?: boolean;

  constructor(fields: { returnOptions?: boolean }) {
    super(fields);
    this.returnOptions = fields.returnOptions;
  }

  async invoke(
    input: string,
    options?: Partial<BaseCallbackConfig>
  ): Promise<Record<string, any>> {
    if (this.returnOptions) {
      return options ?? {};
    }
    return { input };
  }
}

export class FakeLLM extends LLM {
  response?: string;

  thrownErrorString?: string;

  constructor(fields: { response?: string; thrownErrorString?: string }) {
    super({});
    this.response = fields.response;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    return this.response ?? prompt;
  }
}

export class FakeStreamingLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }

  async *_streamResponseChunks(input: string) {
    for (const c of input) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield { text: c, generationInfo: {} } as GenerationChunk;
    }
  }
}

export class FakeChatModel extends BaseChatModel {
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    if (options?.stop?.length) {
      return {
        generations: [
          {
            message: new AIMessage(options.stop[0]),
            text: options.stop[0],
          },
        ],
      };
    }
    const text = messages.map((m) => m.content).join("\n");
    return {
      generations: [
        {
          message: new AIMessage(text),
          text,
        },
      ],
      llmOutput: {},
    };
  }
}

export class FakeRetriever extends BaseRetriever {
  lc_namespace = ["test", "fake"];

  output = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
  ];

  constructor(fields?: { output: Document[] }) {
    super();
    this.output = fields?.output ?? this.output;
  }

  async _getRelevantDocuments(
    _query: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Document<Record<string, any>>[]> {
    return this.output;
  }
}
