import { AIMessageChunk } from "../../messages/index.js";

/** Tiny helper to convert string into char chunk. For eg: Turn `"Hi!"` into `[AIMessageChunk("H"), AIMessageChunk("i"), AIMessageChunk("!")] */
export const charChunks = (text: string) =>
  [...text].map((c) => new AIMessageChunk({ content: c }));
