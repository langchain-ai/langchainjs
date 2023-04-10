import { OpenAI } from "langchain";
import { initializeAgentExecutor } from "langchain/agents";
import { CallbackManager } from "langchain/callbacks";
import { LLMResult } from "langchain/schema";
import { SerpAPI, Calculator, WebBrowser } from "langchain/tools";

export const run = async () => {
  const callbackManager = CallbackManager.fromHandlers({
    async handleLLMStart(_llm: { name: string }, prompts: string[]) {
      console.log(JSON.stringify(prompts, null, 2));
    },
    async handleLLMEnd(output: LLMResult) {
      for (const generation of output.generations) {
        for (const gen of generation) {
          console.log(gen.text);
        }
      }
    },
  });

  const headers = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.5",
    "Alt-Used": "LEAVE-THIS-KEY-SET-BY-TOOL",
    Connection: "keep-alive",
    Host: "LEAVE-THIS-KEY-SET-BY-TOOL",
    Referer: "https://www.google.com/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0",
  };

  const model = new OpenAI({ temperature: 0, callbackManager });
  const tools = [
    new SerpAPI(),
    new Calculator(),
    new WebBrowser(model, headers),
  ];

  const executor = await initializeAgentExecutor(
    tools,
    model,
    "zero-shot-react-description",
    true
  );
  console.log("Loaded agent.");

  const input = `Whats the word of the day on https://www.merriam-webster.com/word-of-the-day?`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.call({ input });

  console.log(`Got output ${result.output}`);
};
