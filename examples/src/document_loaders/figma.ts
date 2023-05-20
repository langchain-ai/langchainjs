import { FigmaFileLoader } from "langchain/document_loaders/web/figma";

const loader = new FigmaFileLoader({
  accessToken: "FIGMA_ACCESS_TOKEN",
  ids: "ids",
  key: "key",
});
const docs = await loader.load();

console.log({ docs });
