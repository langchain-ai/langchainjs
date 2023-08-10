import { expect, test } from "@jest/globals";
import {
  AudioSubtitleLoader,
  AudioTranscriptLoader,
  AudioTranscriptParagraphsLoader,
  AudioTranscriptSentencesLoader,
  SubtitleFormat,
} from "../web/assemblyai.js";

test.skip("Test Invalid API key", async () => {
  const loader = new AudioTranscriptLoader(
    {
      audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    },
    { apiKey: "invalid" }
  );

  await expect(loader.load()).rejects.toThrow(
    "Authentication error, API token missing/invalid"
  );
});

test.skip("Test Audio Transcript Loader", async () => {
  const loader = new AudioTranscriptLoader({
    audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
  });
  const docs = await loader.load();

  expect(docs).toHaveLength(1);
  expect(docs[0].pageContent).not.toBeFalsy();
  expect(docs[0].metadata).not.toBeFalsy();
  console.dir(docs, { depth: Infinity });
});

test.skip("Test Audio Transcript Paragraphs Loader", async () => {
  const loader = new AudioTranscriptParagraphsLoader({
    audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
  });
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThan(1);
  expect(docs[0].pageContent).not.toBeFalsy();
  expect(docs[0].metadata).not.toBeFalsy();
  console.dir(docs, { depth: Infinity });
});

test.skip("Test Audio Transcript Sentences Loader", async () => {
  const loader = new AudioTranscriptSentencesLoader({
    audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
  });
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThan(1);
  expect(docs[0].pageContent).not.toBeFalsy();
  expect(docs[0].metadata).not.toBeFalsy();
  console.dir(docs, { depth: Infinity });
});

test.skip("Test Audio Subtitles Loader", async () => {
  const loader = new AudioSubtitleLoader(
    {
      audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    },
    SubtitleFormat.Srt
  );
  const docs = await loader.load();

  expect(docs).toHaveLength(1);
  expect(docs[0].pageContent).not.toBeFalsy();
  console.dir(docs, { depth: Infinity });
});
