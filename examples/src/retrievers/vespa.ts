import { VespaRetriever } from "langchain/retrievers/vespa";

export const run = async () => {
  const url = "https://doc-search.vespa.oath.cloud";
  const query_body = {
    yql: "select content from paragraph where userQuery()",
    hits: 5,
    ranking: "documentation",
    locale: "en-us",
  };
  const content_field = "content";

  const retriever = new VespaRetriever({
    url,
    auth: false,
    query_body,
    content_field,
  });

  const result = await retriever.getRelevantDocuments("what is vespa?");
  console.log(result);
};
