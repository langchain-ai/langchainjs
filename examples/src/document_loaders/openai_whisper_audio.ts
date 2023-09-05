import { OpenAIWhisperAudio } from "langchain/document_loaders/fs/openai_whisper_audio";
import * as fs from "fs";

const filePath = "PATH TO AUDIO FILE";

const loader = new OpenAIWhisperAudio(filePath, {
  clientOptions: {
    apiKey: "OPENAI_API_KEY",
  },
});

const docs = await loader.load();

console.log(docs);
