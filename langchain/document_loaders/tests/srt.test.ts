import { test } from "@jest/globals";
import { SRTLoader } from "../srt";

test("Test subtitles file loader", async () => {
  const loader = new SRTLoader(
    "../examples/src/document_loaders/example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.srt"
  );
  await loader.load();
});
