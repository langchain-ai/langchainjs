import {
  AudioTranscriptLoader,
  // AudioTranscriptParagraphsLoader,
  // AudioTranscriptSentencesLoader
} from "langchain/document_loaders/web/assemblyai";

// You can also use a local file path and the loader will upload it to AssemblyAI for you.
const audioUrl = "https://storage.googleapis.com/aai-docs-samples/espn.m4a";

// Use `AudioTranscriptParagraphsLoader` or `AudioTranscriptSentencesLoader` for splitting the transcript into paragraphs or sentences
const loader = new AudioTranscriptLoader(
  {
    audio: audioUrl,
    // any other parameters as documented here: https://www.assemblyai.com/docs/api-reference/transcript#create-a-transcript
  },
  {
    apiKey: "<ASSEMBLYAI_API_KEY>", // or set the `ASSEMBLYAI_API_KEY` env variable
  }
);
const docs = await loader.load();
console.dir(docs, { depth: Infinity });
