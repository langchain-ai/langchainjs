import { test } from "@jest/globals";
import { FigmaFileLoader } from "../web/figma.js";

test.skip("Test FigmaFileLoader", async () => {
  const loader = new FigmaFileLoader({
    accessToken: process.env.FIGMA_ACCESS_TOKEN!,
    nodeIds: (process.env.FIGMA_NODE_IDS ?? "").split(","),
    fileKey: process.env.FIGMA_FILE_KEY!,
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const documents = await loader.load();
  // console.log(documents[0].pageContent);
});
