# Vectorstores

A vectorstore is a particular type of database optimized for storing documents, embeddings, and then allowing for fetching of the most relevant documents for a particular query.

## Which one to pick?

Here's a quick guide to help you pick the right vector store for your use case:

- If you're after something that can just run inside your application, in-memory, without any other servers to stand up, then go for [HNSWLib](./hnswlib)
- If you come from Python and you were looking for something similar to FAISS, pick [HNSWLib](./hnswlib)
- If you're looking for an open-source full-featured vector database that you can run locally in a docker container, then go for [Chroma](./chroma)
- If you're using Supabase already then look at the [Supabase](./supabase) vector store to use the same Postgres database for your embeddings too
- If you're looking for a production-ready vector store you don't have to worry about hosting yourself, then go for [Pinecone](./pinecone)
