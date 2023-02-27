import { test } from "@jest/globals";
import { IMSDBLoader } from "../imsdb.js";

test("Test IMSDB loader", async () => {
  const loader = new IMSDBLoader(
    "https://imsdb.com/scripts/BlacKkKlansman.html"
  );
  await loader.load();
});
