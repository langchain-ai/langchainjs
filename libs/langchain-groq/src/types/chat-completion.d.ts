export interface ChatCompletion {
  choices: Array<ChatCompletion.Choice>;

  id?: string;

  created?: number;

  model?: string;

  object?: string;

  system_fingerprint?: string;

  usage?: ChatCompletion.Usage;
}

export namespace ChatCompletion {
  export interface Choice {
    finish_reason: string;

    index: number;

    logprobs: Choice.Logprobs;

    message: Choice.Message;
  }

  export namespace Choice {
    export interface Logprobs {
      content?: Array<Logprobs.Content>;
    }

    export namespace Logprobs {
      export interface Content {
        token?: string;

        bytes?: Array<number>;

        logprob?: number;

        top_logprobs?: Array<Content.TopLogprob>;
      }

      export namespace Content {
        export interface TopLogprob {
          token?: string;

          bytes?: Array<number>;

          logprob?: number;
        }
      }
    }

    export interface Message {
      content: string;

      role: string;

      tool_calls?: Array<Message.ToolCall>;
    }

    export namespace Message {
      export interface ToolCall {
        id?: string;

        function?: ToolCall.Function;

        type?: string;
      }

      export namespace ToolCall {
        export interface Function {
          arguments?: string;

          name?: string;
        }
      }
    }
  }

  export interface Usage {
    completion_time?: number;

    completion_tokens?: number;

    prompt_time?: number;

    prompt_tokens?: number;

    total_time?: number;

    total_tokens?: number;
  }
}
