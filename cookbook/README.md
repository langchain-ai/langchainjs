# LangChain.js cookbook

Example code for building applications with LangChain.js, with an emphasis on more applied and end-to-end examples than contained in the [main documentation](https://js.langchain.com).

## Setup

These cookbooks are in Jupyter notebook form and use the [Deno runtime](https://deno.com) and the experimental [Deno Jupyter Kernel](https://deno.com/blog/v1.37) (requires >= Deno v1.37).

Full installation instructions are available here: https://docs.deno.com/runtime/manual/tools/jupyter

Note that you will also need to install the Python `jupyter` package, and that the syntax for imports and environment variables are slightly different from Node and the web. In particular, we use `Deno.env.get()` to retrieve environment variables, and e.g. `import { PromptTemplate } from "https://esm.sh/langchain/prompts";` to import from a URL to match Deno conventions.

Notebook | Description
:- | :-
[LLaMA2_sql_chat.ipynb](https://github.com/langchain-ai/langchainjs/tree/master/cookbook/LLaMA2_sql_chat.ipynb) | Build a chat application that interacts with a sql database using an open source llm (llama2), specifically demonstrated on a sqlite database containing nba rosters.
