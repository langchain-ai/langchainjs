import { YoutubeLoader } from "langchain/document_loaders/web/youtube";

const loader = YoutubeLoader.createFromUrl("https://youtu.be/bZQun8Y4L2A", {
  language: "en",
  addVideoInfo: true,
});

const docs = await loader.load();

console.log(docs);
