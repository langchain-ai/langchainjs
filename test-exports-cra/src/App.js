/* eslint-disable no-unused-vars */

// import all entrypoints to test, do not do this in your own app
import "./entrypoints.js";

// Import a few things we'll use to test the exports
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";

import { useCallback } from "react";
import { CallbackManager } from "langchain/callbacks";

// Don't do this in your app, it would leak your API key
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

function App() {
  const runChain = useCallback(async () => {
    const llm = new ChatOpenAI({
      openAIApiKey: OPENAI_API_KEY,
      streaming: true,
      callbackManager: CallbackManager.fromHandlers({
        handleLLMNewToken: async (token) =>
          console.log("handleLLMNewToken", token),
      }),
    });

    // Test count tokens
    const n = await llm.getNumTokens("Hello");
    console.log("getNumTokens", n);

    // Test a chain + prompt + model
    const chain = new LLMChain({
      llm,
      prompt: ChatPromptTemplate.fromPromptMessages([
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]),
    });
    const res = await chain.run("hello");

    console.log("runChain", res);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <button onClick={runChain}>Click to run a chain</button>
      </header>
    </div>
  );
}

export default App;
