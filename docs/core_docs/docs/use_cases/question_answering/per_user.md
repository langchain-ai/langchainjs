---
title: Per-User Retrieval
---

When building a retrieval app, you often have to build it with multiple
users in mind. This means that you may be storing data not just for one
user, but for many different users, and they should not be able to see
eachother’s data. This means that you need to be able to configure your
retrieval chain to only retrieve certain information. This generally
involves two steps.

**Step 1: Make sure the retriever you are using supports multiple
users**

At the moment, there is no unified flag or filter for this in LangChain.
Rather, each vectorstore and retriever may have their own, and may be
called different things (namespaces, multi-tenancy, etc). For
vectorstores, this is generally exposed as a keyword argument that is
passed in during `similaritySearch`. By reading the documentation or
source code, figure out whether the retriever you are using supports
multiple users, and, if so, how to use it.

Note: adding documentation and/or support for multiple users for
retrievers that do not support it (or document it) is a GREAT way to
contribute to LangChain

**Step 2: Add that parameter as a configurable field for the chain**

This will let you easily call the chain and configure any relevant flags
at runtime. See [this
documentation](/docs/expression_language/how_to/configure) for more
information on configuration.

**Step 3: Call the chain with that configurable field**

Now, at runtime you can call this chain with configurable field.

## Code Example {#code-example}

Let’s see a concrete example of what this looks like in code. We will
use Memory vectorstore for this example.

## Setup {#setup}

### Dependencies {#dependencies}

We’ll use an OpenAI chat model and embeddings and a Memory vector store
in this walkthrough, but everything shown here works with any
[ChatModel](/docs/modules/model_io/chat) or
[LLM](/docs/modules/model_io/llms),
[Embeddings](https://js.langchain.com/docs/modules/data_connection/text_embedding/),
and
[VectorStore](https://js.langchain.com/docs/modules/data_connection/vectorstores/)
or [Retriever](/docs/modules/data_connection/retrievers/).

We’ll use the following packages:

``` bash
npm install --save langchain @langchain/openai @langchain/pinecone
```

We need to set environment variable `OPENAI_API_KEY`:

``` bash
export OPENAI_API_KEY=YOUR_KEY
```

### LangSmith {#langsmith}

Many of the applications you build with LangChain will contain multiple
steps with multiple invocations of LLM calls. As these applications get
more and more complex, it becomes crucial to be able to inspect what
exactly is going on inside your chain or agent. The best way to do this
is with [LangSmith](https://smith.langchain.com/).

Note that LangSmith is not needed, but it is helpful. If you do want to
use LangSmith, after you sign up at the link above, make sure to set
your environment variables to start logging traces:

``` bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=YOUR_KEY
```

``` typescript
/** @TODO how to do index for each doc added? */

import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

const pinecone = new Pinecone();
const index = pinecone.Index("test-example");
const embeddings = new OpenAIEmbeddings();
const vectorStore = new PineconeStore(index, embeddings);
```

