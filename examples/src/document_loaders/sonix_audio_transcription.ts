import { SonixAudioTranscriptionLoader } from "langchain/document_loaders/web/sonix_audio";

const loader = new SonixAudioTranscriptionLoader({
  sonixAuthKey: "SONIX_AUTH_KEY",
  request: {
    audioFilePath: "LOCAL_AUDIO_FILE_PATH",
    fileName: "FILE_NAME",
    language: "en",
  },
});

const docs = await loader.load();

console.log(docs);
