import type { AwsCredentialIdentity, Provider } from "@aws-sdk/types";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
} from "@langchain/core/messages";
import { ChatGeneration, ChatGenerationChunk } from "@langchain/core/outputs";

export type CredentialType =
  | AwsCredentialIdentity
  | Provider<AwsCredentialIdentity>;

function _formatImage(imageUrl: string) {
  const regex = /^data:(image\/.+);base64,(.+)$/;
  const match = imageUrl.match(regex);
  if (match === null) {
    throw new Error(
      [
        "Anthropic only supports base64-encoded images currently.",
        "Example: data:image/png;base64,/9j/4AAQSk...",
      ].join("\n\n")
    );
  }
  return {
    type: "base64",
    media_type: match[1] ?? "",
    data: match[2] ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function formatMessagesForAnthropic(messages: BaseMessage[]): {
  system?: string;
  messages: Record<string, unknown>[];
} {
  let system: string | undefined;
  if (messages.length > 0 && messages[0]._getType() === "system") {
    if (typeof messages[0].content !== "string") {
      throw new Error("System message content must be a string.");
    }
    system = messages[0].content;
  }
  const conversationMessages =
    system !== undefined ? messages.slice(1) : messages;
  const formattedMessages = conversationMessages.map((message) => {
    let role;
    if (message._getType() === "human") {
      role = "user" as const;
    } else if (message._getType() === "ai") {
      role = "assistant" as const;
    } else if (message._getType() === "system") {
      throw new Error(
        "System messages are only permitted as the first passed message."
      );
    } else {
      throw new Error(`Message type "${message._getType()}" is not supported.`);
    }
    if (typeof message.content === "string") {
      return {
        role,
        content: message.content,
      };
    } else {
      return {
        role,
        content: message.content.map((contentPart) => {
          if (contentPart.type === "image_url") {
            let source;
            if (typeof contentPart.image_url === "string") {
              source = _formatImage(contentPart.image_url);
            } else {
              source = _formatImage(contentPart.image_url.url);
            }
            return {
              type: "image" as const,
              source,
            };
          } else {
            return contentPart;
          }
        }),
      };
    }
  });
  return {
    messages: formattedMessages,
    system,
  };
}

/** Bedrock models.
    To authenticate, the AWS client uses the following methods to automatically load credentials:
    https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html
    If a specific credential profile should be used, you must pass the name of the profile from the ~/.aws/credentials file that is to be used.
    Make sure the credentials / roles used have the required policies to access the Bedrock service.
*/
export interface BaseBedrockInput {
  /** Model to use.
      For example, "amazon.titan-tg1-large", this is equivalent to the modelId property in the list-foundation-models api.
  */
  model: string;

  /** The AWS region e.g. `us-west-2`.
      Fallback to AWS_DEFAULT_REGION env variable or region specified in ~/.aws/config in case it is not provided here.
  */
  region?: string;

  /** AWS Credentials.
      If no credentials are provided, the default credentials from `@aws-sdk/credential-provider-node` will be used.
   */
  credentials?: CredentialType;

  /** Temperature. */
  temperature?: number;

  /** Max tokens. */
  maxTokens?: number;

  /** A custom fetch function for low-level access to AWS API. Defaults to fetch(). */
  fetchFn?: typeof fetch;

  /** @deprecated Use endpointHost instead Override the default endpoint url. */
  endpointUrl?: string;

  /** Override the default endpoint hostname. */
  endpointHost?: string;

  /**
   * Optional additional stop sequences to pass to the model. Currently only supported for Anthropic and AI21.
   * @deprecated Use .bind({ "stop": [...] }) instead
   * */
  stopSequences?: string[];

  /** Additional kwargs to pass to the model. */
  modelKwargs?: Record<string, unknown>;

  /** Whether or not to stream responses */
  streaming: boolean;
}

type Dict = { [key: string]: unknown };

/**
 * A helper class used within the `Bedrock` class. It is responsible for
 * preparing the input and output for the Bedrock service. It formats the
 * input prompt based on the provider (e.g., "anthropic", "ai21",
 * "amazon") and extracts the generated text from the service response.
 */
export class BedrockLLMInputOutputAdapter {
  /** Adapter class to prepare the inputs from Langchain to a format
  that LLM model expects. Also, provides a helper function to extract
  the generated text from the model response. */

  static prepareInput(
    provider: string,
    prompt: string,
    maxTokens = 50,
    temperature = 0,
    stopSequences: string[] | undefined = undefined,
    modelKwargs: Record<string, unknown> = {},
    bedrockMethod: "invoke" | "invoke-with-response-stream" = "invoke"
  ): Dict {
    const inputBody: Dict = {};

    if (provider === "anthropic") {
      inputBody.prompt = prompt;
      inputBody.max_tokens_to_sample = maxTokens;
      inputBody.temperature = temperature;
      inputBody.stop_sequences = stopSequences;
    } else if (provider === "ai21") {
      inputBody.prompt = prompt;
      inputBody.maxTokens = maxTokens;
      inputBody.temperature = temperature;
      inputBody.stopSequences = stopSequences;
    } else if (provider === "meta") {
      inputBody.prompt = prompt;
      inputBody.max_gen_len = maxTokens;
      inputBody.temperature = temperature;
    } else if (provider === "amazon") {
      inputBody.inputText = prompt;
      inputBody.textGenerationConfig = {
        maxTokenCount: maxTokens,
        temperature,
      };
    } else if (provider === "cohere") {
      inputBody.prompt = prompt;
      inputBody.max_tokens = maxTokens;
      inputBody.temperature = temperature;
      inputBody.stop_sequences = stopSequences;
      if (bedrockMethod === "invoke-with-response-stream") {
        inputBody.stream = true;
      }
    } else if (provider === "mistral") {
      inputBody.prompt = prompt;
      inputBody.max_tokens = maxTokens;
      inputBody.temperature = temperature;
      inputBody.stop = stopSequences;
    }
    return { ...inputBody, ...modelKwargs };
  }

  static prepareMessagesInput(
    provider: string,
    messages: BaseMessage[],
    maxTokens = 1024,
    temperature = 0,
    stopSequences: string[] | undefined = undefined,
    modelKwargs: Record<string, unknown> = {}
  ): Dict {
    const inputBody: Dict = {};

    if (provider === "anthropic") {
      const { system, messages: formattedMessages } =
        formatMessagesForAnthropic(messages);
      if (system !== undefined) {
        inputBody.system = system;
      }
      inputBody.anthropic_version = "bedrock-2023-05-31";
      inputBody.messages = formattedMessages;
      inputBody.max_tokens = maxTokens;
      inputBody.temperature = temperature;
      inputBody.stop_sequences = stopSequences;
      return { ...inputBody, ...modelKwargs };
    } else {
      throw new Error(
        "The messages API is currently only supported by Anthropic"
      );
    }
  }

  /**
   * Extracts the generated text from the service response.
   * @param provider The provider name.
   * @param responseBody The response body from the service.
   * @returns The generated text.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static prepareOutput(provider: string, responseBody: any): string {
    if (provider === "anthropic") {
      return responseBody.completion;
    } else if (provider === "ai21") {
      return responseBody?.completions?.[0]?.data?.text ?? "";
    } else if (provider === "cohere") {
      return responseBody?.generations?.[0]?.text ?? responseBody?.text ?? "";
    } else if (provider === "meta") {
      return responseBody.generation;
    } else if (provider === "mistral") {
      return responseBody?.outputs?.[0]?.text;
    }

    // I haven't been able to get a response with more than one result in it.
    return responseBody.results?.[0]?.outputText;
  }

  static prepareMessagesOutput(
    provider: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: any
  ): ChatGeneration | undefined {
    const responseBody = response ?? {};
    if (provider === "anthropic") {
      if (responseBody.type === "message_start") {
        return parseMessage(responseBody.message, true);
      } else if (
        (responseBody.type === "content_block_delta" &&
          responseBody.delta?.type === "text_delta",
          typeof responseBody.delta?.text === "string")
      ) {
        return new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: responseBody.delta.text,
          }),
          text: responseBody.delta.text,
        });
      } else if (responseBody.type === "message_delta") {
        return new ChatGenerationChunk({
          message: new AIMessageChunk({ content: "" }),
          text: "",
          generationInfo: {
            ...responseBody.delta,
            usage: responseBody.usage,
          },
        });
      } else if (
        responseBody.type === "message_stop" &&
        responseBody["amazon-bedrock-invocationMetrics"] !== undefined
      ) {
        return new ChatGenerationChunk({
          message: new AIMessageChunk({ content: "" }),
          text: "",
          generationInfo: {
            "amazon-bedrock-invocationMetrics":
              responseBody["amazon-bedrock-invocationMetrics"],
          },
        });
      } else if (responseBody.type === "message") {
        return parseMessage(responseBody);
      } else {
        return undefined;
      }
    } else {
      throw new Error(
        "The messages API is currently only supported by Anthropic."
      );
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMessage(responseBody: any, asChunk?: boolean): ChatGeneration {
  const { content, id, ...generationInfo } = responseBody;
  let parsedContent;
  if (
    Array.isArray(content) &&
    content.length === 1 &&
    content[0].type === "text"
  ) {
    parsedContent = content[0].text;
  } else if (Array.isArray(content) && content.length === 0) {
    parsedContent = "";
  } else {
    parsedContent = content;
  }
  if (asChunk) {
    return new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: parsedContent,
        additional_kwargs: { id },
      }),
      text: typeof parsedContent === "string" ? parsedContent : "",
      generationInfo,
    });
  } else {
    return {
      message: new AIMessage({
        content: parsedContent,
        additional_kwargs: { id },
      }),
      text: typeof parsedContent === "string" ? parsedContent : "",
      generationInfo,
    };
  }
}
