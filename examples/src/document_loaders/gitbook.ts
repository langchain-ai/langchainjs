import { GitbookLoader } from "langchain/document_loaders";

export const run = async () => {
  const loader = new GitbookLoader("https://docs.gitbook.com");
  const docs = await loader.load(); // load single path
  const docsAllPaths = await loader.load(true); // loads all paths of the given gitbook
  console.log({ docs, docsAllPaths });
};
