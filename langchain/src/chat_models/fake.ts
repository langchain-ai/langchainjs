import { BaseChatModel, BaseChatModelParams } from "./base.js";
import { AIMessage, BaseMessage, ChatResult } from "../schema/index.js";

/**
 * Interface for the input parameters specific to the Fake List Chat model.
 */
export interface FakeChatInput extends BaseChatModelParams {
  /** Responses to return */
  responses: string[];
}
  
/** 
 * A fake Chat Model that returns a predefined list of responses. It can be used
 * for testing purposes.
 */
export class FakeListChatModel extends BaseChatModel {
  static lc_name() {
    return "Fake List";
  }

  responses: string[];

  i = 0;

  constructor({ responses }: FakeChatInput) {
    super({});
    this.responses = responses;
  }
  
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake-list";
  }

  async _generate(
    _messages: BaseMessage[],
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

    const response = this._currentResponse();
    this._incrementResponse();
    
    return {
      generations: [
        {
          message: new AIMessage(response),
          text: response,
        },
      ],
      llmOutput: {},
    };
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
