import { DiscussServiceClient, protos } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { AIMessage, BaseMessage, ChatResult } from "../schema/index.js";
import { getEnvironmentVariable } from "../util/env.js";
import { BaseChatModel, BaseChatModelParams } from "./base.js";

export interface GooglePalmChatInput extends BaseChatModelParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `models/{model}`
   */
  model?: string;

  /**
   * Controls the randomness of the output.
   *
   * Values can range from [0.0,1.0], inclusive. A value closer to 1.0
   * will produce responses that are more varied and creative, while
   * a value closer to 0.0 will typically result in less surprising
   * responses from the model.
   *
   * Note: The default value varies by model
   */
  temperature?: number;

  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   *
   * Note: The default value varies by model
   */
  topP?: number;

  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   *
   * Note: The default value varies by model
   */
  topK?: number;

  examples?: protos.google.ai.generativelanguage.v1beta2.IExample[];

  /**
   * Google Palm API key to use
   */
  apiKey?: string;
}

export class ChatGooglePalm
  extends BaseChatModel
  implements GooglePalmChatInput
{
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLEPALM_API_KEY",
    };
  }

  model = "models/chat-bison-001";

  temperature?: number = undefined; // default value chosen based on model

  topP?: number = undefined; // default value chosen based on model

  topK?: number = undefined; // default value chosen based on model

  examples: protos.google.ai.generativelanguage.v1beta2.IExample[] = [];

  apiKey?: string;

  private client: DiscussServiceClient;

  constructor(fields?: GooglePalmChatInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    if (this.model && !this.model.startsWith("models/")) {
      throw new Error(
        "`model` value must follow the pattern - `models/{model}`"
      );
    }

    this.temperature = fields?.temperature ?? this.temperature;
    if (this.temperature && (this.temperature < 0 || this.temperature > 1)) {
      throw new Error("`temperature` must be in the range of [0.0,1.0]");
    }

    this.topP = fields?.topP ?? this.topP;
    if (this.topP && this.topP < 0) {
      throw new Error("`topP` must be a positive integer");
    }

    this.topK = fields?.topK ?? this.topK;
    if (this.topK && this.topK < 0) {
      throw new Error("`topK` must be a positive integer");
    }

    this.examples = fields?.examples ?? this.examples;

    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable("GOOGLEPALM_API_KEY");
    if (!this.apiKey) {
      throw new Error(
        "Please set an API key for Google Palm 2 in the environment variable GOOGLEPALM_API_KEY or in the `apiKey` field of the GooglePalm constructor"
      );
    }

    this.client = new DiscussServiceClient({
      authClient: new GoogleAuth().fromAPIKey(this.apiKey),
    });
  }

  _combineLLMOutput() {
    return [];
  }

  _llmType() {
    return "googlepalm";
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const chatResult = await this.caller.callWithOptions(
      { signal: options.signal },
      this._palmGenerateMessage.bind(this),
      messages
    );

    // Google Palm doesn't provide streaming as of now. But to support streaming handlers
    // we call the handler with entire response text
    void runManager?.handleLLMNewToken(
      chatResult.generations.length > 0 ? chatResult.generations[0].text : ""
    );

    return chatResult;
  }

  async _palmGenerateMessage(messages: BaseMessage[]): Promise<ChatResult> {
    const res = await this.client.generateMessage({
      candidateCount: 1,
      model: this.model,
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      prompt: {
        context: this._getPalmContextInstruction(messages),
        examples: this.examples,
        messages: this._mapBaseMessagesToPalmMessages(messages),
      },
    });
    return this._mapPalmMessagesToChatResult(res[0]);
  }

  _getPalmContextInstruction(messages: BaseMessage[]): string | undefined {
    // filters out all 'system' messages, but select the first message
    // as Palm chat prompt context
    const systemMessages = messages.filter((m) => m._getType() === "system");
    return systemMessages && systemMessages.length > 0
      ? systemMessages[0].content
      : undefined;
  }

  _mapBaseMessagesToPalmMessages(
    messages: BaseMessage[]
  ): protos.google.ai.generativelanguage.v1beta2.IMessage[] {
    // remove all 'system' messages
    const filteredMessages = messages.filter((m) => m._getType() !== "system");

    // merges successive messages of same type (say if consecutive human messages) into a single message
    // Google Palm requires messages of alternative types
    // i.e. 'human, bot, human, bot, human', but not - 'human, human, bot, bot'
    const mergedMessages: BaseMessage[] = [];
    filteredMessages.forEach((m) => {
      const lastMergedMessage = mergedMessages.at(-1);
      if (lastMergedMessage && m._getType() === lastMergedMessage._getType()) {
        lastMergedMessage.content = `${lastMergedMessage.content}\n${m.content}`;
      } else {
        mergedMessages.push(m);
      }
    });

    return mergedMessages.map((m) => ({
      author: m.name,
      content: m.content,
      citationMetadata: {
        citationSources: m.additional_kwargs.citationSources as
          | protos.google.ai.generativelanguage.v1beta2.ICitationSource[]
          | undefined,
      },
    }));
  }

  _mapPalmMessagesToChatResult(
    msgRes: protos.google.ai.generativelanguage.v1beta2.IGenerateMessageResponse
  ): ChatResult {
    if (
      msgRes.candidates &&
      msgRes.candidates.length > 0 &&
      msgRes.candidates[0]
    ) {
      const message = msgRes.candidates[0];
      return {
        generations: [
          {
            text: message.content ?? "",
            message: new AIMessage({
              content: message.content ?? "",
              name: message.author === null ? undefined : message.author,
              additional_kwargs: {
                citationSources: message.citationMetadata?.citationSources,
                filters: msgRes.filters, // content filters applied
              },
            }),
          },
        ],
      };
    }
    // if rejected or error, return empty generations with reason in filters
    return {
      generations: [],
      llmOutput: {
        filters: msgRes.filters,
      },
    };
  }
}
