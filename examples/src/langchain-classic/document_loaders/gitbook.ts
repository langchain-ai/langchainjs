import { GitbookLoader } from "@langchain/community/document_loaders/web/gitbook";

export const run = async () => {
  const loader = new GitbookLoader("https://docs.gitbook.com");
  const docs = await loader.load(); // load single path
  console.log(docs);
  const allPathsLoader = new GitbookLoader("https://docs.gitbook.com", {
    shouldLoadAllPaths: true,
  });
  const docsAllPaths = await allPathsLoader.load(); // loads all paths of the given gitbook
  console.log(docsAllPaths);
};
