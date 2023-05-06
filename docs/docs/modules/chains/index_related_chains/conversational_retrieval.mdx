---
hide_table_of_contents: true
sidebar_position: 3
---

import CodeBlock from "@theme/CodeBlock";
import ConvoRetrievalQAExample from "@examples/chains/conversational_qa.ts";

# Conversational Retrieval QA

The `ConversationalRetrievalQA` chain builds on `RetrievalQAChain` to provide a chat history component.

It requires two inputs: a question and the chat history. It first combines the chat history and the question into a standalone question, then looks up relevant documents from the retriever, and then passes those documents and the question to a question answering chain to return a response.

To create one, you will need a retriever. In the below example, we will create one from a vectorstore, which can be created from embeddings.

import Example from "@examples/chains/conversational_qa.ts";

<CodeBlock language="typescript">{ConvoRetrievalQAExample}</CodeBlock>

In this code snippet, the fromLLM method of the `ConversationalRetrievalQAChain` class has the following signature:

```typescript
static fromLLM(
  llm: BaseLanguageModel,
  retriever: BaseRetriever,
  options?: {
    questionGeneratorTemplate?: string;
    qaTemplate?: string;
    returnSourceDocuments?: boolean;
  }
): ConversationalRetrievalQAChain
```

Here's an explanation of each of the attributes of the options object:

- `questionGeneratorTemplate`: A string that specifies a question generation template. If provided, the `ConversationalRetrievalQAChain` will use this template to generate a question from the conversation context, instead of using the question provided in the question parameter. This can be useful if the original question does not contain enough information to retrieve a suitable answer.
- `qaTemplate`: A string that specifies a response template. If provided, the `ConversationalRetrievalQAChain` will use this template to format a response before returning the result. This can be useful if you want to customize the way the response is presented to the end user.
- `returnSourceDocuments`: A boolean value that indicates whether the `ConversationalRetrievalQAChain` should return the source documents that were used to retrieve the answer. If set to true, the documents will be included in the result returned by the call() method. This can be useful if you want to allow the user to see the sources used to generate the answer. If not set, the default value will be false.

In summary, the `questionGeneratorTemplate`, `qaTemplate`, and `returnSourceDocuments` options allow the user to customize the behavior of the `ConversationalRetrievalQAChain`
