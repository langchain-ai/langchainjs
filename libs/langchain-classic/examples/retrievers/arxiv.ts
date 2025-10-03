import { ArxivRetriever } from "@langchain/community/retrievers/arxiv";

export const run = async () => {
  /*
    Direct look up by arXiv ID, for full texts
  */

  const queryId = "1605.08386 2103.03404";
  const retrieverById = new ArxivRetriever({
    getFullDocuments: true,
    maxSearchResults: 5,
  });
  const documentsById = await retrieverById.invoke(queryId);
  console.log(documentsById);

  /*
  [
    Document
    {
      pageContent,
      metadata: 
      {
        author,
        id,
        published,
        source,
        updated,
        url
      }
    },
    Document
    {
      pageContent,
      metadata
    }
  ]
  */

  /*
  Search with natural language query, for summaries
  */

  const queryNat = "What is the ImageBind model?";
  const retrieverByNat = new ArxivRetriever({
    getFullDocuments: false,
    maxSearchResults: 2,
  });
  const documentsByQuery = await retrieverByNat.invoke(queryNat);
  console.log(documentsByQuery);

  /*
  [
    Document
    {
      pageContent,
      metadata
    },
    Document
    {
      pageContent,
      metadata
    }
  ]
  */
};
