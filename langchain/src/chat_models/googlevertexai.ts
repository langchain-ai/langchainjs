import { BaseChatModel } from "./base.js";
import {
  AIChatMessage,
  BaseChatMessage,
  ChatGeneration,
  ChatResult,
  LLMResult,
  MessageType,
  SystemChatMessage,
} from "../schema/index.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import {GoogleVertexAiConnection} from "../util/googlevertexai-connection.js";
import {
  GoogleVertexAiBaseLLMInput,
  GoogleVertexAiBasePrediction,
  GoogleVertexAiLLMResponse,
  GoogleVertexAiModelParams
} from "../types/googlevertexai-types.js";

/**
 * Represents a single "example" exchange that can be provided to
 * help illustrate what a model response should look like.
 */
export interface ChatExample {
  input: BaseChatMessage;
  output: BaseChatMessage;
}

interface GoogleVertexAiChatExample {
  input: GoogleVertexAiChatMessage;
  output: GoogleVertexAiChatMessage;
}

export type AuthorType = "user" | "bot";

export interface GoogleVertexAiChatMessage {
  author: AuthorType;
  content: string;
  name?: string;
}

export interface GoogleVertexAiChatInstance {
  context?: string;
  examples?: GoogleVertexAiChatExample[];
  messages: GoogleVertexAiChatMessage[];
}

export interface GoogleVertexAiChatPrediction
  extends GoogleVertexAiBasePrediction {
  candidates: GoogleVertexAiChatMessage[];
}

export interface GoogleVertexAiChatInput extends GoogleVertexAiBaseLLMInput {
  /** Instructions how the model should respond */
  context?: string;

  /** Help the model understand what an appropriate response is */
  examples?: ChatExample[];

  /**
   * A map of OpenAI role names and their corresponding Vertex AI
   * author name.
   */
  roleAlias?: RoleAlias;
}

export type RoleAlias = Record<MessageType, AuthorType | undefined>;

export interface GoogleVertexAiChatCallOptions
  extends BaseLanguageModelCallOptions {
  context?: string;

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
export class GoogleVertexAiChat
  extends BaseChatModel
  implements GoogleVertexAiChatInput
{
  declare CallOptions: GoogleVertexAiChatCallOptions;

  model = "chat-bison";

  temperature = 0.2;

  maxTokens = 256;

  topP = 0.8;

  topK = 40;

  context: string;

  examples: ChatExample[];

  roleAlias: RoleAlias = {
    human: "user",
    ai: "bot",
    generic: undefined,
    system: undefined,
  };

  connection: GoogleVertexAiConnection<
    this["CallOptions"],
    GoogleVertexAiChatInstance,
    GoogleVertexAiChatPrediction
  >;

  SystemMessage = new SystemChatMessage("");

  constructor(fields?: GoogleVertexAiChatInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.context = fields?.context ?? this.context;
    this.examples = fields?.examples ?? this.examples;
    this.roleAlias = fields?.roleAlias ?? this.roleAlias;

    this.connection = new GoogleVertexAiConnection(fields, this.caller);
  }

  _combineLLMOutput(): // ...llmOutputs: LLMResult["llmOutput"][]
  LLMResult["llmOutput"] {
    // TODO: Combine the safetyAttributes
    return [];
  }

  async _generate(
    messages: BaseChatMessage[],
    options: this["ParsedCallOptions"]
    // runManager is omitted since we can't issue token updates
  ): Promise<ChatResult> {
    // Build the instances in the requeswt, which may be built from
    // a combination (in highest to lowest priority) of the messages
    // passed in, the options passed in, and the configuration parameters
    // passed to the constructor.
    const fromMessages = this.convertMessages(messages);
    const fromOptions = this.convertOptions(options);
    const instance: GoogleVertexAiChatInstance = {
      context:
        fromMessages.context ?? fromOptions.context ?? this.context ?? "",
      examples:
        fromOptions.examples ?? this.convertExamples(this.examples) ?? [],
      messages: fromMessages.messages,
    };

    const parameters: GoogleVertexAiModelParams = {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxTokens: this.maxTokens,
    };

    const result = await this.connection.request(
      [instance],
      parameters,
      options
    );

    return this.convertResult(result);
  }

  _llmType(): string {
    return "googlevertexai";
  }

  convertMessages(baseMessages: BaseChatMessage[]): GoogleVertexAiChatInstance {
    let context = "";
    const messages: GoogleVertexAiChatMessage[] = [];

    baseMessages.forEach((baseMessage) => {
      if (this.SystemMessage.typeEquals(baseMessage)) {
        // System messages should be added to the context prompt
        context += baseMessage.text;
      } else {
        // Convert the message and add it to the list of messages
        // if it is a valid author type.
        const message = this.convertMessage(baseMessage);
        if (message.author) {
          messages.push(message);
        }
      }
    });

    return {
      context,
      messages,
    };
  }

  convertMessage(baseMessage: BaseChatMessage): GoogleVertexAiChatMessage {
    const ret: GoogleVertexAiChatMessage = {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      author: this.roleAlias[baseMessage._getType()],
      content: baseMessage.text,
    };
    return ret;
  }

  convertOptions(
    options: GoogleVertexAiChatCallOptions
  ): GoogleVertexAiChatInstance {
    const examples = options?.examples
      ? this.convertExamples(options.examples)
      : [];

    return {
      context: options?.context,
      examples,
      messages: [],
    };
  }

  convertExample(example: ChatExample): GoogleVertexAiChatExample {
    return {
      input: this.convertMessage(example.input),
      output: this.convertMessage(example.output),
    };
  }

  convertExamples(
    examples: ChatExample[] | undefined
  ): GoogleVertexAiChatExample[] {
    return examples?.map((example) => this.convertExample(example)) ?? [];
  }

  convertResult(
    result: GoogleVertexAiLLMResponse<GoogleVertexAiChatPrediction>
  ): ChatResult {
    const generations = this.convertPredictions(result?.data?.predictions);
    return {
      generations,
    };
  }

  convertPredictions(
    predictions: GoogleVertexAiChatPrediction[]
  ): ChatGeneration[] {
    return predictions.map((prediction) => this.convertPrediction(prediction));
  }

  convertPrediction(prediction: GoogleVertexAiChatPrediction): ChatGeneration {
    const message = prediction?.candidates[0];
    return {
      text: message?.content,
      message: this.convertPredictionMessage(message),
      generationInfo: prediction,
    };
  }

  convertPredictionMessage(
    message: GoogleVertexAiChatMessage
  ): BaseChatMessage {
    return new AIChatMessage(message.content);
  }
}
