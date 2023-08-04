import { SberSaluteAudioTranscriptionLoader } from "langchain/document_loaders/fs/sber_salute";

const loader = new SberSaluteAudioTranscriptionLoader({
  sberSaluteAuthKey: "",
  pathToAudioFile: "./audio.wav",
  audioEncoding: "PCM_S16LE",
});

const docs = await loader.load();

console.log(docs);
