import { test, expect } from "@jest/globals";
import { YoutubeLoader } from "../web/youtube.js";

test("Test Youtube loader", async () => {
  const videoUrl = "https://www.youtube.com/watch?v=FZhbJZEgKQ4";
  const loader = YoutubeLoader.createFromUrl(videoUrl, {
    language: "en",
    addVideoInfo: true,
  });
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain(
    "One year ago, at the dawn of a new age,"
  );
  expect(docs[0].metadata).toMatchObject({
    author: "Microsoft",
    source: "FZhbJZEgKQ4",
    title: "Full Keynote: Satya Nadella at Microsoft Ignite 2023",
  });
});
