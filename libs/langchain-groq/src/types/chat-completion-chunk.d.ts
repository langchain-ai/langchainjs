export interface ChatCompletionChunk {
  id: string;

  choices: Array<ChatCompletionChunk.Choice>;

  created: number;

  model: string;

  object: 'chat.completion.chunk';

  system_fingerprint?: string;
}

export namespace ChatCompletionChunk {
  export interface Choice {
    delta: Choice.Delta;

    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call' | null;

    index: number;

    logprobs?: Choice.Logprobs | null;
  }

  export namespace Choice {
    export interface Delta {
      content?: string | null;

      function_call?: Delta.FunctionCall;

      role?: 'system' | 'user' | 'assistant' | 'tool';

      tool_calls?: Array<Delta.ToolCall>;
    }

    export namespace Delta {
      export interface FunctionCall {
        arguments?: string;

        name?: string;
      }

      export interface ToolCall {
        index: number;

        id?: string;

        function?: ToolCall.Function;

        type?: 'function';
      }

      export namespace ToolCall {
        export interface Function {
          arguments?: string;

          name?: string;
        }
      }
    }

    export interface Logprobs {
      content: Array<ChatCompletionTokenLogprob> | null;
    }
  }
}

export interface ChatCompletionTokenLogprob {
  token: string;

  bytes: Array<number> | null;

  logprob: number;

  top_logprobs: Array<ChatCompletionTokenLogprob.TopLogprob>;
}

export namespace ChatCompletionTokenLogprob {
  export interface TopLogprob {
    token: string;

    bytes: Array<number> | null;

    logprob: number;
  }
}
