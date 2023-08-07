import {
  AudioTranscriptLoader,
  AudioTranscriptParagraphsLoader,
  AudioTranscriptSentencesLoader,
  AudioSubtitleLoader
} from "langchain/document_loaders/web/assemblyai";

// You can also use a local file path and the loader will upload it to AssemblyAI for you
const audioUrl = "https://storage.googleapis.com/aai-docs-samples/nbc.mp3";

// use `AudioTranscriptParagraphsLoader` or `AudioTranscriptSentencesLoader` for splitting the transcript into paragraphs or sentences
const transcriptLoader = new AudioTranscriptLoader(
  {
    audio_url: audioUrl
  },
  {
    apiKey: "<ASSEMBLYAI_API_KEY>" // or set the `ASSEMBLYAI_API_KEY` env variable
  }
);
const transcriptDocs = await transcriptLoader.load();
console.dir(transcriptDocs, { depth: Infinity });


const subtitleLoader = new AudioSubtitleLoader(
  {
    audio_url: audioUrl
  },
  "srt", // srt or vtt
  {
    apiKey: "<ASSEMBLYAI_API_KEY>" // or set the `ASSEMBLYAI_API_KEY` env variable
  }
);

const subtitleDocs = await subtitleLoader.load();
console.dir(subtitleDocs, { depth: Infinity });