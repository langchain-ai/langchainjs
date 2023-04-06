// Import a few things we'll use to test the exports
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
// import { OpenAI } from "langchain/llms";
// import { TextLoader } from "langchain/document_loaders";

import logo from "./logo.svg";
import "./App.css";
import { useEffect } from "react";

const OPENAI_API_KEY = "";

function App() {
  const runChain = async () => {
    // Test a chain + prompt + model
    const chain = new LLMChain({
      llm: new ChatOpenAI({ openAIApiKey: OPENAI_API_KEY }),
      prompt: ChatPromptTemplate.fromPromptMessages([
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]),
    });
    const res = await chain.run("hello");

    console.log("runChain", res);
  };

  useEffect(() => {
    runChain();
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
      </header>
    </div>
  );
}

export default App;
