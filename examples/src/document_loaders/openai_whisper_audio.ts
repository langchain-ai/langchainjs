import { OpenAIWhisperAudio } from "langchain/document_loaders/fs/openai_whisper_audio";
import * as fs from "fs";

const filePath = "PATH TO AUDIO FILE";
const audioFile = fs.createReadStream(filePath) as unknown as File;

const loader = new OpenAIWhisperAudio({
  openAIConfiguration: {
    apiKey: "OPENAI_API_KEY",
  },
  audioFile,
});

const docs = await loader.load();

console.log(docs);
