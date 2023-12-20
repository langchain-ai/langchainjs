// mistral-client.d.ts
declare module "@mistralai/mistralai" {
  export type ChatCompletionResult = {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices:
      | Array<{
          index: number;
          message?: {
            role?: "user" | "assistant";
            content?: string;
          };
          finish_reason: "stop" | "length" | "model_length";
        }>
      | Array<{
          index: number;
          delta?: {
            role?: "user" | "assistant";
            content?: string;
          };
          finish_reason: "stop" | "length" | "model_length";
        }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
  }

  export interface EmbeddingsResult {
    id: string;
    object: string;
    data: Array<{
      object: string;
      embedding: number[];
      index: number;
    }>;
    model: string;
    usage: {
      prompt_tokens: number;
      total_tokens: number;
    };
  }

  export interface ChatCompletionOptions {
    model: string;
    messages: Array<Message>;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    randomSeed?: number;
    safeMode?: boolean;
  }

  export default class MistralClient {
    constructor(apiKey?: string, endpoint?: string);

    listModels(): Promise<any>;

    chat(options: ChatCompletionOptions): Promise<any>;

    chatStream(
      options: ChatCompletionOptions
    ): AsyncGenerator<any, void, unknown>;

    embeddings(options: {
      model: string;
      input: string | string[];
    }): Promise<any>;
  }
}
