import { ChaindeskRetriever } from "@langchain/community/retrievers/chaindesk";

const retriever = new ChaindeskRetriever({
  datastoreId: "DATASTORE_ID",
  apiKey: "CHAINDESK_API_KEY", // optional: needed for private datastores
  topK: 8, // optional: default value is 3
});

const docs = await retriever.invoke("hello");

console.log(docs);
