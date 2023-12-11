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
          message?: Array<{
            role?: "user" | "assistant";
            content?: string;
          }>;
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

  export default class MistralClient {
    constructor(apiKey?: string, endpoint?: string);

    listModels(): Promise<any>;

    chat(options: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      randomSeed?: number;
      safeMode?: boolean;
    }): Promise<any>;

    chatStream(options: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      randomSeed?: number;
      safeMode?: boolean;
    }): AsyncGenerator<any, void, unknown>;

    embeddings(options: {
      model: string;
      input: string | string[];
    }): Promise<any>;
  }
}
