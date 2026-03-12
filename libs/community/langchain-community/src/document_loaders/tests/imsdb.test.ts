import { test } from "vitest";
import { IMSDBLoader } from "../web/imsdb.js";

test("Test IMSDB loader", async () => {
  const loader = new IMSDBLoader(
    "https://imsdb.com/scripts/BlacKkKlansman.html"
  );
  await loader.load();
});
