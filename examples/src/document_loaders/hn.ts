import { HNLoader } from "langchain/document_loaders/web/hn";

export const run = async () => {
  const loader = new HNLoader("https://news.ycombinator.com/item?id=34817881");
  const docs = await loader.load();
  console.log({ docs });
};
