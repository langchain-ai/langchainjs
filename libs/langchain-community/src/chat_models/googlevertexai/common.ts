import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
  LLMResult,
} from "@langchain/core/outputs";

import {
  GoogleVertexAILLMConnection,
  GoogleVertexAIStream,
} from "../../utils/googlevertexai-connection.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAILLMPredictions,
  GoogleVertexAIModelParams,
} from "../../types/googlevertexai-types.js";

/**
 * Represents a single "example" exchange that can be provided to
 * help illustrate what a model response should look like.
 */
export interface ChatExample {
  input: BaseMessage;
  output: BaseMessage;
}

/**
 * Represents a single example exchange in the Google Vertex AI chat
 * model.
 */
interface GoogleVertexAIChatExample {
  input: GoogleVertexAIChatMessage;
  output: GoogleVertexAIChatMessage;
}

/**
 * Represents the author of a chat message in the Google Vertex AI chat
 * model.
 */
export type GoogleVertexAIChatAuthor =
  | "user" // Represents the human for Code and CodeChat models
  | "bot" // Represents the AI for Code models
  | "system" // Represents the AI for CodeChat models
  | "context"; // Represents contextual instructions

export type GoogleVertexAIChatMessageFields = {
  author?: GoogleVertexAIChatAuthor;
  content: string;
  name?: string;
};

/**
 * Represents a chat message in the Google Vertex AI chat model.
 */
export class GoogleVertexAIChatMessage {
  public author?: GoogleVertexAIChatAuthor;

  public content: string;

  public name?: string;

  constructor(fields: GoogleVertexAIChatMessageFields) {
    this.author = fields.author;
    this.content = fields.content;
    this.name = fields.name;
  }

  /**
   * Extracts the role of a generic message and maps it to a Google Vertex
   * AI chat author.
   * @param message The chat message to extract the role from.
   * @returns The role of the message mapped to a Google Vertex AI chat author.
   */
  static extractGenericMessageCustomRole(message: ChatMessage) {
    if (
      message.role !== "system" &&
      message.role !== "bot" &&
      message.role !== "user" &&
      message.role !== "context"
    ) {
      console.warn(`Unknown message role: ${message.role}`);
    }

    return message.role as GoogleVertexAIChatAuthor;
  }

  /**
   * Maps a message type to a Google Vertex AI chat author.
   * @param message The message to map.
   * @param model The model to use for mapping.
   * @returns The message type mapped to a Google Vertex AI chat author.
   */
  static mapMessageTypeToVertexChatAuthor(
    message: BaseMessage,
    model: string
  ): GoogleVertexAIChatAuthor {
    const type = message._getType();
    switch (type) {
      case "ai":
        return model.startsWith("codechat-") ? "system" : "bot";
      case "human":
        return "user";
      case "system":
        throw new Error(
          `System messages are only supported as the first passed message for Google Vertex AI.`
        );
      case "generic": {
        if (!ChatMessage.isInstance(message))
          throw new Error("Invalid generic chat message");
        return GoogleVertexAIChatMessage.extractGenericMessageCustomRole(
          message
        );
      }
      default:
        throw new Error(`Unknown / unsupported message type: ${message}`);
    }
  }

  /**
   * Creates a new Google Vertex AI chat message from a base message.
   * @param message The base message to convert.
   * @param model The model to use for conversion.
   * @returns A new Google Vertex AI chat message.
   */
  static fromChatMessage(message: BaseMessage, model: string) {
    if (typeof message.content !== "string") {
      throw new Error(
        "ChatGoogleVertexAI does not support non-string message content."
      );
    }
    return new GoogleVertexAIChatMessage({
      author: GoogleVertexAIChatMessage.mapMessageTypeToVertexChatAuthor(
        message,
        model
      ),
      content: message.content,
    });
  }
}

/**
 * Represents an instance of the Google Vertex AI chat model.
 */
export interface GoogleVertexAIChatInstance {
  context?: string;
  examples?: GoogleVertexAIChatExample[];
  messages: GoogleVertexAIChatMessage[];
}

/**
 * Defines the prediction output of the Google Vertex AI chat model.
 */
export interface GoogleVertexAIChatPrediction
  extends GoogleVertexAIBasePrediction {
  candidates: GoogleVertexAIChatMessage[];
}

/**
 * Defines the input to the Google Vertex AI chat model.
 */
export interface GoogleVertexAIChatInput<AuthOptions>
  extends GoogleVertexAIBaseLLMInput<AuthOptions> {
  /** Instructions how the model should respond */
  context?: string;

  /** Help the model understand what an appropriate response is */
  examples?: ChatExample[];
}

/**
 * Base class for Google Vertex AI chat models.
 * Implemented subclasses must provide a GoogleVertexAILLMConnection
 * with appropriate auth client.
 */
export class BaseChatGoogleVertexAI<AuthOptions>
  extends BaseChatModel
  implements GoogleVertexAIChatInput<AuthOptions>
{
  lc_serializable = true;

  model = "chat-bison";

  temperature = 0.2;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  examples: ChatExample[] = [];

  connection: GoogleVertexAILLMConnection<
    BaseLanguageModelCallOptions,
    GoogleVertexAIChatInstance,
    GoogleVertexAIChatPrediction,
    AuthOptions
  >;

  streamedConnection: GoogleVertexAILLMConnection<
    BaseLanguageModelCallOptions,
    GoogleVertexAIChatInstance,
    GoogleVertexAIChatPrediction,
    AuthOptions
  >;

  get lc_aliases(): Record<string, string> {
    return {
      model: "model_name",
    };
  }

  constructor(fields?: GoogleVertexAIChatInput<AuthOptions>) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;
    this.examples = fields?.examples ?? this.examples;
  }

  _combineLLMOutput(): LLMResult["llmOutput"] {
    // TODO: Combine the safetyAttributes
    return [];
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // Make the call as a streaming request
    const instance: GoogleVertexAIChatInstance = this.createInstance(_messages);
    const parameters = this.formatParameters();
    const result = await this.streamedConnection.request(
      [instance],
      parameters,
      _options
    );

    // Get the streaming parser of the response
    const stream = result.data as GoogleVertexAIStream;

    // Loop until the end of the stream
    // During the loop, yield each time we get a chunk from the streaming parser
    // that is either available or added to the queue
    while (!stream.streamDone) {
      const output = await stream.nextChunk();
      const chunk =
        output !== null
          ? BaseChatGoogleVertexAI.convertPredictionChunk(output)
          : new ChatGenerationChunk({
              text: "",
              message: new AIMessageChunk(""),
              generationInfo: { finishReason: "stop" },
            });
      yield chunk;
    }
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const instance: GoogleVertexAIChatInstance = this.createInstance(messages);
    const parameters: GoogleVertexAIModelParams = this.formatParameters();

    const result = await this.connection.request(
      [instance],
      parameters,
      options
    );

    const generations =
      (
        result?.data as GoogleVertexAILLMPredictions<GoogleVertexAIChatPrediction>
      )?.predictions?.map((prediction) =>
        BaseChatGoogleVertexAI.convertPrediction(prediction)
      ) ?? [];
    return {
      generations,
    };
  }

  _llmType(): string {
    return "vertexai";
  }

  /**
   * Creates an instance of the Google Vertex AI chat model.
   * @param messages The messages for the model instance.
   * @returns A new instance of the Google Vertex AI chat model.
   */
  createInstance(messages: BaseMessage[]): GoogleVertexAIChatInstance {
    let context = "";
    let conversationMessages = messages;
    if (messages[0]?._getType() === "system") {
      if (typeof messages[0].content !== "string") {
        throw new Error(
          "ChatGoogleVertexAI does not support non-string message content."
        );
      }
      context = messages[0].content;
      conversationMessages = messages.slice(1);
    }
    // https://cloud.google.com/vertex-ai/docs/generative-ai/chat/test-chat-prompts
    if (conversationMessages.length % 2 === 0) {
      throw new Error(
        `Google Vertex AI requires an odd number of messages to generate a response.`
      );
    }
    const vertexChatMessages = conversationMessages.map((baseMessage, i) => {
      const currMessage = GoogleVertexAIChatMessage.fromChatMessage(
        baseMessage,
        this.model
      );
      const prevMessage =
        i > 0
          ? GoogleVertexAIChatMessage.fromChatMessage(
              conversationMessages[i - 1],
              this.model
            )
          : null;

      // https://cloud.google.com/vertex-ai/docs/generative-ai/chat/chat-prompts#messages
      if (prevMessage && currMessage.author === prevMessage.author) {
        throw new Error(
          `Google Vertex AI requires AI and human messages to alternate.`
        );
      }
      return currMessage;
    });

    const examples = this.examples.map((example) => ({
      input: GoogleVertexAIChatMessage.fromChatMessage(
        example.input,
        this.model
      ),
      output: GoogleVertexAIChatMessage.fromChatMessage(
        example.output,
        this.model
      ),
    }));

    const instance: GoogleVertexAIChatInstance = {
      context,
      examples,
      messages: vertexChatMessages,
    };

    return instance;
  }

  formatParameters(): GoogleVertexAIModelParams {
    return {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
    };
  }

  /**
   * Converts a prediction from the Google Vertex AI chat model to a chat
   * generation.
   * @param prediction The prediction to convert.
   * @returns The converted chat generation.
   */
  static convertPrediction(
    prediction: GoogleVertexAIChatPrediction
  ): ChatGeneration {
    const message = prediction?.candidates[0];
    return {
      text: message?.content,
      message: new AIMessage(message.content),
      generationInfo: prediction,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static convertPredictionChunk(output: any): ChatGenerationChunk {
    const generation: ChatGeneration = BaseChatGoogleVertexAI.convertPrediction(
      output.outputs[0]
    );
    return new ChatGenerationChunk({
      text: generation.text,
      message: new AIMessageChunk(generation.message),
      generationInfo: generation.generationInfo,
    });
  }
}
