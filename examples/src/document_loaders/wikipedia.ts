import { WikipediaLoader } from "langchain/document_loaders/web/wikipedia";

export const run = async () => {
  const loader = new WikipediaLoader(
    "https://en.wikipedia.org/wiki/2020_Summer_Olympics"
  );
  const docs = await loader.load();
  console.log({ docs });
};
