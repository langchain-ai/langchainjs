import { BaseChatModel } from "./base.js";
import {
  AIChatMessage,
  BaseChatMessage,
  ChatGeneration,
  ChatResult,
  LLMResult,
  MessageType,
} from "../schema/index.js";
import { GoogleVertexAIConnection } from "../util/googlevertexai-connection.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAIModelParams,
} from "../types/googlevertexai-types.js";

/**
 * Represents a single "example" exchange that can be provided to
 * help illustrate what a model response should look like.
 */
export interface ChatExample {
  input: BaseChatMessage;
  output: BaseChatMessage;
}

interface GoogleVertexAIChatExample {
  input: GoogleVertexAIChatMessage;
  output: GoogleVertexAIChatMessage;
}

export type GoogleVertexAIChatAuthor = "user" | "bot" | "context";

export type GoogleVertexAIChatMessageFields = {
  author?: GoogleVertexAIChatAuthor;
  content: string;
  name?: string;
};

export class GoogleVertexAIChatMessage {
  public author?: GoogleVertexAIChatAuthor;

  public content: string;

  public name?: string;

  constructor(fields: GoogleVertexAIChatMessageFields) {
    this.author = fields.author;
    this.content = fields.content;
    this.name = fields.name;
  }

  static mapMessageTypeToVertexChatAuthor(
    baseMessageType: MessageType
  ): GoogleVertexAIChatAuthor {
    switch (baseMessageType) {
      case "ai":
        return "bot";
      case "human":
        return "user";
      case "system":
        throw new Error(
          `System messages are only supported as the first passed message for Google Vertex AI.`
        );
      case "generic":
        throw new Error(
          `Generic messages are not supported by Google Vertex AI.`
        );
      default:
        throw new Error(`Unknown message type: ${baseMessageType}`);
    }
  }

  static fromChatMessage(message: BaseChatMessage) {
    return new GoogleVertexAIChatMessage({
      author: GoogleVertexAIChatMessage.mapMessageTypeToVertexChatAuthor(
        message._getType()
      ),
      content: message.text,
    });
  }
}

export interface GoogleVertexAIChatInstance {
  context?: string;
  examples?: GoogleVertexAIChatExample[];
  messages: GoogleVertexAIChatMessage[];
}

export interface GoogleVertexAIChatPrediction
  extends GoogleVertexAIBasePrediction {
  candidates: GoogleVertexAIChatMessage[];
}

export interface GoogleVertexAIChatInput extends GoogleVertexAIBaseLLMInput {
  /** Instructions how the model should respond */
  context?: string;

  /** Help the model understand what an appropriate response is */
  examples?: ChatExample[];
}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models in a chat-like fashion.
 *
 * To use, you will need to have one of the following authentication
 * methods in place:
 * - You are logged into an account permitted to the Google Cloud project
 *   using Vertex AI.
 * - You are running this on a machine using a service account permitted to
 *   the Google Cloud project using Vertex AI.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the
 *   Google Cloud project using Vertex AI.
 */
export class ChatGoogleVertexAI
  extends BaseChatModel
  implements GoogleVertexAIChatInput
{
  model = "chat-bison";

  temperature = 0.2;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  examples: ChatExample[] = [];

  connection: GoogleVertexAIConnection<
    this["CallOptions"],
    GoogleVertexAIChatInstance,
    GoogleVertexAIChatPrediction
  >;

  constructor(fields?: GoogleVertexAIChatInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;
    this.examples = fields?.examples ?? this.examples;

    this.connection = new GoogleVertexAIConnection(
      {
        ...fields,
        ...this,
      },
      this.caller
    );
  }

  _combineLLMOutput(): LLMResult["llmOutput"] {
    // TODO: Combine the safetyAttributes
    return [];
  }

  // TODO: Add streaming support
  async _generate(
    messages: BaseChatMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const instance: GoogleVertexAIChatInstance = this.createInstance(messages);

    const parameters: GoogleVertexAIModelParams = {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
    };

    const result = await this.connection.request(
      [instance],
      parameters,
      options
    );

    const generations =
      result?.data?.predictions?.map((prediction) =>
        ChatGoogleVertexAI.convertPrediction(prediction)
      ) ?? [];
    return {
      generations,
    };
  }

  _llmType(): string {
    return "googlevertexai";
  }

  createInstance(messages: BaseChatMessage[]): GoogleVertexAIChatInstance {
    let context = "";
    let conversationMessages = messages;
    if (messages[0]?._getType() === "system") {
      context = messages[0].text;
      conversationMessages = messages.slice(1);
    }
    // https://cloud.google.com/vertex-ai/docs/generative-ai/chat/test-chat-prompts
    if (conversationMessages.length % 2 === 0) {
      throw new Error(
        `Google Vertex AI requires an odd number of messages to generate a response.`
      );
    }
    const vertexChatMessages = conversationMessages.map((baseMessage, i) => {
      // https://cloud.google.com/vertex-ai/docs/generative-ai/chat/chat-prompts#messages
      if (
        i > 0 &&
        baseMessage._getType() === conversationMessages[i - 1]._getType()
      ) {
        throw new Error(
          `Google Vertex AI requires AI and human messages to alternate.`
        );
      }
      return GoogleVertexAIChatMessage.fromChatMessage(baseMessage);
    });

    const examples = this.examples.map((example) => ({
      input: GoogleVertexAIChatMessage.fromChatMessage(example.input),
      output: GoogleVertexAIChatMessage.fromChatMessage(example.output),
    }));

    const instance: GoogleVertexAIChatInstance = {
      context,
      examples,
      messages: vertexChatMessages,
    };

    return instance;
  }

  static convertPrediction(
    prediction: GoogleVertexAIChatPrediction
  ): ChatGeneration {
    const message = prediction?.candidates[0];
    return {
      text: message?.content,
      message: new AIChatMessage(message.content),
      generationInfo: prediction,
    };
  }
}
