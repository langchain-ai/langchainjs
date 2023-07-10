# Databerry

This page covers how to use the [Databerry](https://databerry.ai) within LangChain.

## What is Databerry?

Databerry is an [open source](https://github.com/gmpetrov/databerry) document retrieval platform that helps to connect your personal data with Large Language Models.

![Databerry](/img/DataberryDashboard.png)

## Quick start

Retrieving documents stored in Databerry from LangChain is very easy!

```typescript
import { DataberryRetriever } from "langchain/retrievers/databerry";

const retriever = new DataberryRetriever({
  datastoreUrl: "https://api.databerry.ai/query/clg1xg2h80000l708dymr0fxc",
  apiKey: "DATABERRY_API_KEY", // optional: needed for private datastores
  topK: 8, // optional: default value is 3
});

// Create a chain that uses the OpenAI LLM and Databerry retriever.
const chain = RetrievalQAChain.fromLLM(model, retriever);

// Call the chain with a query.
const res = await chain.call({
  query: "What's Databerry?",
});

console.log({ res });
/*
{
  res: {
    text: 'Databerry provides a user-friendly solution to quickly setup a semantic search system over your personal data without any technical knowledge.'
  }
}
*/
```
