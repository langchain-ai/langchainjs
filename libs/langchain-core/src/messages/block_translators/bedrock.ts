import type { StandardContentBlockTranslator } from "./index.js";

export const bedrockTranslator: StandardContentBlockTranslator = {
  translateContent: () => {
    throw new Error("Not implemented");
  },
  translateContentChunk: () => {
    throw new Error("Not implemented");
  },
};
