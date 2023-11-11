import { test } from "@jest/globals";
import { GooglePlacesAPI } from "../google_place.js";

test.skip("GoogleCustomSearchTool", async () => {
  const tool = new GooglePlacesAPI();

  const result = await tool.call("EatonCenter");

  console.log({ result });
});
