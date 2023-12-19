import { expect, test } from "@jest/globals";
import {
  AudioSubtitleLoader,
  AudioTranscriptLoader,
  AudioTranscriptParagraphsLoader,
  AudioTranscriptSentencesLoader,
} from "../web/assemblyai.js";

// eslint-disable-next-line no-process-env
const transcriptId = process.env.ASSEMBLYAI_TRANSCRIPT_ID;
console.log(transcriptId);
if (!transcriptId) throw new Error("ASSEMBLYAI_TRANSCRIPT_ID not set");

describe.skip("AssemblyAI", () => {
  test("Invalid API key", async () => {
    const loader = new AudioTranscriptLoader(
      {
        audio: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
      },
      { apiKey: "invalid" }
    );

    await expect(loader.load()).rejects.toThrow(
      "Authentication error, API token missing/invalid"
    );
  });

  test("Create and retrieve transcript", async () => {
    const loader = new AudioTranscriptLoader({
      audio: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    });
    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Create and retrieve transcript (deprecated)", async () => {
    const loader = new AudioTranscriptLoader({
      audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    });
    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Retrieve transcript by ID", async () => {
    const loader = new AudioTranscriptLoader(transcriptId);
    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Create and retrieve paragraphs", async () => {
    const loader = new AudioTranscriptParagraphsLoader({
      audio: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    });
    const docs = await loader.load();

    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Create and retrieve paragraphs (deprecated)", async () => {
    const loader = new AudioTranscriptParagraphsLoader({
      audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    });
    const docs = await loader.load();

    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Retrieve paragraphs by ID", async () => {
    const loader = new AudioTranscriptParagraphsLoader(transcriptId);
    const docs = await loader.load();

    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Create and retrieve sentences", async () => {
    const loader = new AudioTranscriptSentencesLoader({
      audio: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    });
    const docs = await loader.load();

    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Create and retrieve sentences (deprecated)", async () => {
    const loader = new AudioTranscriptSentencesLoader({
      audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
    });
    const docs = await loader.load();

    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Retrieve sentences by ID", async () => {
    const loader = new AudioTranscriptSentencesLoader(transcriptId);
    const docs = await loader.load();

    expect(docs.length).toBeGreaterThan(1);
    expect(docs[0].pageContent).not.toBeFalsy();
    expect(docs[0].metadata).not.toBeFalsy();
  });

  test("Create and retrieve subtitles", async () => {
    const loader = new AudioSubtitleLoader(
      {
        audio: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
      },
      "srt"
    );
    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).not.toBeFalsy();
  });

  test("Create and retrieve subtitles (deprecated)", async () => {
    const loader = new AudioSubtitleLoader(
      {
        audio_url: "https://storage.googleapis.com/aai-docs-samples/nbc.mp3",
      },
      "srt"
    );
    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).not.toBeFalsy();
  });

  test("Retrieve subtitles by ID", async () => {
    const loader = new AudioSubtitleLoader(transcriptId, "srt");
    const docs = await loader.load();

    expect(docs).toHaveLength(1);
    expect(docs[0].pageContent).not.toBeFalsy();
  });
});
