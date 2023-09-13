import { BaseChatModel } from "../base.js";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
  LLMResult,
} from "../../schema/index.js";
import { GoogleVertexAILLMConnection, GoogleVertexAIChatMessage, GoogleVertexAIChatInstance } from "../../util/googlevertexai-connection.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAIModelParams,
} from "../../types/googlevertexai-types.js";
import { BaseLanguageModelCallOptions } from "../../base_language/index.js";
import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";

/**
 * Represents a single "example" exchange that can be provided to
 * help illustrate what a model response should look like.
 */
export interface ChatExample {
  input: BaseMessage;
  output: BaseMessage;
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

  async _generate(
    messages: BaseMessage[],
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
        BaseChatGoogleVertexAI.convertPrediction(prediction)
      ) ?? [];
    return {
      generations,
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const instance: GoogleVertexAIChatInstance = this.createInstance(messages);

    const parameters: GoogleVertexAIModelParams = {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
    };

    const stream = this.connection.stream([instance], parameters, options);
    for await (const chunk of stream) {
      const generationChunk = new ChatGenerationChunk({
        message: new AIMessageChunk({ content: JSON.stringify(chunk) }),
        text: JSON.stringify(chunk),
        generationInfo: {}
      });
      yield generationChunk;
      // const choice = chunk?.choices[0];
      // if (!choice) {
      //   continue;
      // }

      // const { delta } = choice;
      // const chunk = _convertDeltaToMessageChunk(delta, defaultRole);
      // defaultRole = delta.role ?? defaultRole;
      // const newTokenIndices = {
      //   prompt: options.promptIndex ?? 0,
      //   completion: choice.index ?? 0,
      // };
      // const generationChunk = new ChatGenerationChunk({
      //   message: chunk,
      //   text: chunk.content,
      //   generationInfo: newTokenIndices,
      // });
      // yield generationChunk;
      // // eslint-disable-next-line no-void
      // void runManager?.handleLLMNewToken(
      //   generationChunk.text ?? "",
      //   newTokenIndices,
      //   undefined,
      //   undefined,
      //   undefined,
      //   { chunk: generationChunk }
      // );
    }
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
}
