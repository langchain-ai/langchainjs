import path from "node:path";

import { OpenAITranscriptions } from "@langchain/openai";
import fs from "node:fs/promises";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const audioFilePath = path.join(__dirname, "..", "..", "..", "libs", "langchain-openai", "src", "tests", "__fixtures__", "audio.mp3");
const audio = fs.readFile(audioFilePath);

console.log("🎤 OpenAI Transcription Examples\n");

// Example 1: Whisper model with all response formats
console.log("🔹 Whisper Model (supports all formats)");
const whisperTranscriber = new OpenAITranscriptions({
  model: "whisper-1", // Default model
  temperature: 0,
  language: "en",
});

console.log(
  "Result:",
  await whisperTranscriber.transcribe({ audio })
);

// Example 2: GPT model with limited response formats
console.log("🔹 GPT Model (supports text and json only)");
const gptTranscriber = new OpenAITranscriptions<"gpt-4o-mini-transcribe">({
  model: "gpt-4o-mini-transcribe",
  response_format: "json", // GPT models only support "text" and "json"
});
console.log(
  "Result:",
  await gptTranscriber.transcribe({ audio })
);

// Example 3: Verbose transcription with timestamps
console.log("🔹 Verbose transcription with timestamps");
const verboseResult = await whisperTranscriber.transcribe<"verbose_json">({
  audio,
  options: {
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
    temperature: 0.1,
  },
});

// TypeScript knows these fields exist because we specified "verbose_json"
console.log("Full transcription:", verboseResult.text);
console.log("Language detected:", verboseResult.language);
console.log("Duration:", verboseResult.duration);
console.log("Word timestamps:", verboseResult.words);
console.log("Segments:", verboseResult.segments);