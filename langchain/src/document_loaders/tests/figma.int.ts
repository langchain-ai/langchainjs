import { FigmaFileLoader } from "../web/figma.js";
/* eslint-disable import/no-extraneous-dependencies */
// eslint-disable-next-line import/order
import { test } from "@jest/globals";

test("Test FigmaFileLoader", async () => {
  const loader = new FigmaFileLoader({
    // eslint-disable-next-line no-process-env
    accessToken: process.env?.FIGMA_ACCESS_TOKEN,
    ids: "1,2,3",
    key: "fileKey",
  });
  const documents = await loader.load();
  console.log(documents[0].pageContent);
});
