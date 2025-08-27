import type { StandardContentBlockTranslator } from "./index.js";

export const googleVertexaiTranslator: StandardContentBlockTranslator = {
  translateContent: () => {
    throw new Error("Not implemented");
  },
  translateContentChunk: () => {
    throw new Error("Not implemented");
  },
};
