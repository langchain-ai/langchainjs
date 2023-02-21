import { test } from "@jest/globals";
import { IMSDBLoader } from "../imsdb";

test("Test IMSDB loader", async () => {
  const loader = new IMSDBLoader(
    "https://imsdb.com/scripts/BlacKkKlansman.html"
  );
  const docs = await loader.load();
  console.log({ docs });
});
