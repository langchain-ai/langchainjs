import { VideoTranscriptionLoader } from "langchain/document_loaders/fs/video_transcription";

const loader = new VideoTranscriptionLoader("video.mp4");

const docs = await loader.load();

console.log(docs);
