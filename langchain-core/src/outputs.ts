import { type BaseMessage, type BaseMessageChunk } from "./messages/index.js";

export const RUN_KEY = "__run";

/**
 * Output of a single generation.
 */
export interface Generation {
  /**
   * Generated text output
   */
  text: string;
  /**
   * Raw generation info response from the provider.
   * May include things like reason for finishing (e.g. in {@link OpenAI})
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
}

export type GenerationChunkFields = {
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generationInfo?: Record<string, any>;
};

/**
 * Chunk of a single generation. Used for streaming.
 */
export class GenerationChunk implements Generation {
  public text: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public generationInfo?: Record<string, any>;

  constructor(fields: GenerationChunkFields) {
    this.text = fields.text;
    this.generationInfo = fields.generationInfo;
  }

  concat(chunk: GenerationChunk): GenerationChunk {
    return new GenerationChunk({
      text: this.text + chunk.text,
      generationInfo: {
        ...this.generationInfo,
        ...chunk.generationInfo,
      },
    });
  }
}

/**
 * Contains all relevant information returned by an LLM.
 */
export type LLMResult = {
  /**
   * List of the things generated. Each input could have multiple {@link Generation | generations}, hence this is a list of lists.
   */
  generations: Generation[][];
  /**
   * Dictionary of arbitrary LLM-provider specific output.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
  /**
   * Dictionary of run metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [RUN_KEY]?: Record<string, any>;
};

export interface ChatGeneration extends Generation {
  message: BaseMessage;
}

export type ChatGenerationChunkFields = GenerationChunkFields & {
  message: BaseMessageChunk;
};

export class ChatGenerationChunk
  extends GenerationChunk
  implements ChatGeneration
{
  public message: BaseMessageChunk;

  constructor(fields: ChatGenerationChunkFields) {
    super(fields);
    this.message = fields.message;
  }

  concat(chunk: ChatGenerationChunk) {
    return new ChatGenerationChunk({
      text: this.text + chunk.text,
      generationInfo: {
        ...this.generationInfo,
        ...chunk.generationInfo,
      },
      message: this.message.concat(chunk.message),
    });
  }
}

export interface ChatResult {
  generations: ChatGeneration[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llmOutput?: Record<string, any>;
}
