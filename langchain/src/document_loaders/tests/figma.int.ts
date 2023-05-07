/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/order */
import { FigmaFileLoader } from "../web/figma.js";
import { test } from "@jest/globals";

test("Test FigmaFileLoader", async () => {
  const loader = new FigmaFileLoader({ accessToken: "", ids: "", key: "" });
  const documents = await loader.load();
  console.log(documents[0].pageContent);
});
