export namespace CompletionCreateParams {
  export interface Message {
    content: string;

    role: string;

    name?: string;

    /**
     * ToolMessage Fields
     */
    tool_call_id?: string;

    /**
     * AssistantMessage Fields
     */
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

  export interface ResponseFormat {
    type?: string;
  }

  export interface ToolChoice {
    string?: string;

    toolChoice?: ToolChoice.ToolChoice;
  }

  export namespace ToolChoice {
    export interface ToolChoice {
      function?: ToolChoice.Function;

      type?: string;
    }

    export namespace ToolChoice {
      export interface Function {
        name?: string;
      }
    }
  }

  export interface Tool {
    function?: Tool.Function;

    type?: string;
  }

  export namespace Tool {
    export interface Function {
      description?: string;

      name?: string;

      parameters?: Record<string, unknown>;
    }
  }
}
