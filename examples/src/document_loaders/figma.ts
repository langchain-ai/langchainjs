import { FigmaFileLoader } from "langchain/document_loaders/web/figma";

const loader = new FigmaFileLoader({
  accessToken: "FIGMA_ACCESS_TOKEN", // or load it from process.env.FIGMA_ACCESS_TOKEN
  nodeIds: ["id1", "id2", "id3"],
  fileKey: "key",
});
const docs = await loader.load();

console.log({ docs });
