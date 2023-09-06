import { OpenAIWhisperAudio } from "langchain/document_loaders/fs/openai_whisper_audio";

const filePath = "./src/document_loaders/example_data/test.mp3";

const loader = new OpenAIWhisperAudio(filePath);

const docs = await loader.load();

console.log(docs);
