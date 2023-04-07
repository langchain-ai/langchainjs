// Import a few things we'll use to test the exports
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";

import logo from "./logo.svg";
import "./App.css";
import { useCallback } from "react";
import { CallbackManager } from "langchain/callbacks";

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

function App() {
  const runChain = useCallback(async () => {
    // Test a chain + prompt + model
    const chain = new LLMChain({
      llm: new ChatOpenAI({
        openAIApiKey: OPENAI_API_KEY,
        streaming: true,
        callbackManager: CallbackManager.fromHandlers({
          handleLLMNewToken: async (token) =>
            console.log("handleLLMNewToken", token),
        }),
      }),
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
        <img src={logo} className="App-logo" alt="logo" />
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
