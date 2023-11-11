# LangChain.js cookbook

Example code for building applications with LangChain.js, with an emphasis on more applied and end-to-end examples than contained in the [main documentation](https://js.langchain.com).

## Setup

These cookbooks are in Jupyter notebook form and use the [Deno runtime](https://deno.com) and the experimental [Deno Jupyter Kernel](https://deno.com/blog/v1.37) (requires >= Deno v1.37).

Full installation instructions are available here: https://docs.deno.com/runtime/manual/tools/jupyter

Note that you will also need to install the Python `jupyter` package, and that the syntax for imports and environment variables are slightly different from Node and the web. In particular, we use `Deno.env.get()` to retrieve environment variables, and e.g. `import { PromptTemplate } from "https://esm.sh/langchain/prompts";` to import from a URL to match Deno conventions.

Notebook | Description
:- | :-
[rewrite.ipynb](https://github.com/langchain-ai/langchainjs/tree/master/cookbook/rewrite.ipynb) | Handle real-world questions that contain extraneous, distracting information in your RAG chains by first rewriting them before performing retrieval.
[rag_fusion.ipynb](https://github.com/langchain-ai/langchainjs/tree/master/cookbook/rag_fusion.ipynb) | Turn user queries into more search friendly queries, then query a vector store and use reciprocal rank fusion to rank the results.
[basic_critique_revise.ipynb](https://github.com/langchain-ai/langchainjs/tree/master/cookbook/basic_critique_revise.ipynb) | Basic example of correcting an LLM's output using a pattern called critique-revise, where we highlight what part of the output is wrong and re-query the LLM for a correction.
[step_back.ipynb](https://github.com/langchain-ai/langchainjs/tree/master/cookbook/step_back.ipynb) | Example of a step back prompting technique, where we ask the LLM to take a step back and rephrase the original query for a more search friendly question.