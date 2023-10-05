import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import {
  BaseMessage,
  ChatResult,
  AIMessage,
  ChatMessage,
} from "../../schema/index.js";
import { BaseChatModelParams, BaseChatModel } from "../base.js";

interface CitationSource {
  startIndex?: number | null;
  endIndex?: number | null;
  uri?: string | null;
  license?: string | null;
}

interface Message {
  author?: string | null;
  content: string;
  citationMetadata?: {
    citationSources?: Array<CitationSource>;
  };
}

interface Example {
  input: Message;
  output: Message;
}

interface ContentFilter {
  reason: "BLOCKED_REASON_UNSPECIFIED" | "SAFETY" | "OTHER";
  message: string;
}

interface MessagePrompt {
  context?: string | null;
  examples?: Array<Example>;
  messages: Array<Message>;
}

interface GenerateMessageRequest {
  prompt: MessagePrompt;
  temperature?: number;
  candidateCount?: number;
  topP?: number;
  topK?: number;
}

interface GenerateMessageResponse {
  candidates: Array<Message>;
  messages: Array<Message>;
  filters?: Array<ContentFilter>;
}

interface WebGooglePaLMChatInput extends BaseChatModelParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `models/{model}`
   */
  modelName?: string;
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

  examples?: Array<Example>;

  // examples?: protos.google.ai.generativelanguage.v1beta2.IExample[];
  /**
   * Google Palm API key to use
   */
  apiKey?: string;
}

function getMessageAuthor(message: BaseMessage) {
  const type = message._getType();
  if (ChatMessage.isInstance(message)) {
    return message.role;
  }
  return message.name ?? type;
}

export class ChatGooglePalm
  extends BaseChatModel
  implements WebGooglePaLMChatInput
{
  lc_serializable = true;

  static lc_name() {
    return "ChatGooglePalm";
  }

  get lc_secrets(): { [key: string]: string } {
    return {
      apiKey: "GOOGLE_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      apiKey: "google_api_key",
    };
  }

  modelName = "models/chat-bison-001";

  temperature?: number;

  topP?: number;

  topK?: number;

  examples?: Array<Example>;

  apiKey: string;

  constructor(fields?: WebGooglePaLMChatInput) {
    super({ ...fields });

    this.modelName = fields?.modelName ?? this.modelName;
    this.temperature = fields?.temperature;
    this.topP = fields?.topP;
    this.topK = fields?.topK;
    this.examples = fields?.examples;
    this.apiKey = fields?.apiKey ?? "";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _combineLLMOutput?(): Record<string, any> {
    return {};
  }

  _llmType(): string {
    return "google_palm";
  }

  protected _getPalmContextInstruction(
    messages: BaseMessage[]
  ): string | undefined {
    // get the first message and checks if it's a system 'system' messages
    const systemMessage =
      messages.length > 0 && getMessageAuthor(messages[0]) === "system"
        ? messages[0]
        : undefined;
    return systemMessage?.content;
  }

  protected _mapBaseMessagesToPalmMessages(messages: BaseMessage[]): Message[] {
    // remove all 'system' messages
    const nonSystemMessages = messages.filter(
      (m) => getMessageAuthor(m) !== "system"
    );

    // requires alternate human & ai messages. Throw error if two messages are consecutive
    nonSystemMessages.forEach((msg, index) => {
      if (index < 1) return;
      if (
        getMessageAuthor(msg) === getMessageAuthor(nonSystemMessages[index - 1])
      ) {
        throw new Error(
          `Google PaLM requires alternate messages between authors`
        );
      }
    });

    return nonSystemMessages.map((m) => ({
      author: getMessageAuthor(m),
      content: m.content,
      citationMetadata: {
        citationSources: m.additional_kwargs.citationSources as
          | CitationSource[]
          | undefined,
      },
    }));
  }

  protected _mapPalmMessagesToChatResult(
    msgRes: GenerateMessageResponse
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

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const url = new URL(
      `/v1beta2/${this.modelName}:generateMessage`,
      "https://generativelanguage.googleapis.com"
    );

    const payload: GenerateMessageRequest = {
      candidateCount: 1,
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      prompt: {
        examples: this.examples,
        context: this._getPalmContextInstruction(messages),
        messages: this._mapBaseMessagesToPalmMessages(messages),
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });

    if (!response.ok) {
      let error = new Error(`Failed to call PaLM API: ${response.status}`);
      try {
        const payload = await response.json();
        error = new Error(
          `${payload.error?.status}: ${payload.error?.message}`
        );
      } catch {
        // ignore
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }

    const json: GenerateMessageResponse = await response.json();
    const chatResult = this._mapPalmMessagesToChatResult(json);

    void runManager?.handleLLMNewToken(
      chatResult.generations.length > 0 ? chatResult.generations[0].text : ""
    );

    return chatResult;
  }
}
