// Manually generated for now
import { Gemini } from "../chat_models/types.js";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AIStudio {

  export interface Request {
    model?: string; // Documentation says required, but tests say otherwise
    content: Gemini.Content;
    outputDimensionality?: number;
  }

  export interface ContentEmbedding {
    values: number[];
    shape: number[];
  }

  export interface Response {
    embedding: ContentEmbedding;
  }

}