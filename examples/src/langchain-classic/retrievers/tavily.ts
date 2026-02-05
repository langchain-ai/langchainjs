import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";

const retriever = new TavilySearchAPIRetriever({
  k: 3,
});

const retrievedDocs = await retriever.invoke(
  "What did the speaker say about Justice Breyer in the 2022 State of the Union?"
);
console.log({ retrievedDocs });

/*
  {
    retrievedDocs: [
      Document {
        pageContent: `Shy Justice Br eyer. During his remarks, the president paid tribute to retiring Supreme Court Justice Stephen Breyer. "Tonight, I'd like to honor someone who dedicated his life to...`,
        metadata: [Object]
      },
      Document {
        pageContent: 'Fact Check. Ukraine. 56 Posts. Sort by. 10:16 p.m. ET, March 1, 2022. Biden recognized outgoing Supreme Court Justice Breyer during his speech. President Biden recognized outgoing...',
        metadata: [Object]
      },
      Document {
        pageContent: `In his State of the Union address on March 1, Biden thanked Breyer for his service. "I'd like to honor someone who has dedicated his life to serve this country: Justice Breyer — an Army...`,
        metadata: [Object]
      }
    ]
  }
*/
