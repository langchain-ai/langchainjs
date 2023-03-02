export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  /**
   * Generated text output.
   */
  text: string;

  /**
   * Role of the agent that generated the text.
   */
  role: string;
};

export type ChatGeneration = {
  message: ChatMessage;

  /**
   * Raw generation info from the provider.
   * May include things like reason for finishing (e.g. in {@link OpenAI})
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
};

export type ChatResult = {
  generations: ChatGeneration[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
};

export abstract class BaseChatModel {
  async generate(
    messages: ChatMessage[],
    stop?: string[]
  ): Promise<ChatResult> {
    return this._generate(messages, stop);
  }

  abstract _generate(
    messages: ChatMessage[],
    stop?: string[]
  ): Promise<ChatResult>;

  async run(messages: ChatMessage[], stop?: string[]): Promise<ChatMessage> {
    const { generations } = await this.generate(messages, stop);
    return generations[0].message;
  }
}

export abstract class SimpleChatModel extends BaseChatModel {
  role: Role = "assistant";

  constructor(role?: Role) {
    super();
    this.role = role ?? this.role;
  }

  abstract _call(messages: ChatMessage[], stop?: string[]): Promise<string>;

  async _generate(
    messages: ChatMessage[],
    stop?: string[]
  ): Promise<ChatResult> {
    const text = await this._call(messages, stop);
    const message: ChatMessage = {
      text,
      role: this.role,
    };
    return {
      generations: [
        {
          message,
        },
      ],
    };
  }
}
