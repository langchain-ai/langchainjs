import { AudioLoader } from "langchain/document_loaders";

export const run = async () => {
  const loader = new AudioLoader("src/document_loaders/example_data/hello.mp3");
  const audio = await loader.load();
  console.log(audio);
};
