import { loadSummarizationChain } from "langchain/chains";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ChatAnthropic } from "langchain/chat_models/anthropic";

// In this example, we use a separate LLM as the final summary LLM to meet our customized LLM requirements for different stages of the chain and to only stream the final results.
const text = fs.readFileSync("state_of_the_union.txt", "utf8");
const model = new ChatAnthropic({ temperature: 0 });
const combineModel = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0,
  streaming: true,
  callbacks: [
    {
      handleLLMNewToken(token: string): Promise<void> | void {
        console.log("token", token);
        /*
          token President
          token  Biden
          ...
          ...
          token  protections
          token .
        */
      },
    },
  ],
});
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 5000 });
const docs = await textSplitter.createDocuments([text]);

// This convenience function creates a document chain prompted to summarize a set of documents.
const chain = loadSummarizationChain(model, {
  type: "map_reduce",
  combineLLM: combineModel,
});
const res = await chain.call({
  input_documents: docs,
});
console.log({ res });
/*
  {
    res: {
      text: "President Biden delivered his first State of the Union address, focusing on the Russian invasion of Ukraine, domestic economic challenges, and his administration's efforts to revitalize American manufacturing and infrastructure. He announced new sanctions against Russia and the deployment of U.S. forces to NATO countries. Biden also outlined his plan to fight inflation, lower costs for American families, and reduce the deficit. He emphasized the need to pass the Bipartisan Innovation Act, confirmed his Federal Reserve nominees, and called for the end of COVID shutdowns. Biden also addressed issues such as gun violence, voting rights, immigration reform, women's rights, and privacy protections."
    }
  }
*/
