import { LLMChain } from "../../chains/llm_chain.js";
import { BaseChatModel } from "../../chat_models/base.js";
import { VectorStoreRetriever } from "../../vectorstores/base.js";
import { Tool } from "../../tools/base.js";

import { AutoGPTOutputParser } from "./output_parser.js";
import { AutoGPTPrompt } from "./prompt.js";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "../../schema/index.js";
// import { HumanInputRun } from "./tools/human/tool"; // TODO
import { ObjectTool, FINISH_NAME } from "./schema.js";
import { TokenTextSplitter } from "../../text_splitter.js";
import {
  getEmbeddingContextSize,
  getModelContextSize,
} from "../../base_language/count_tokens.js";

/**
 * Interface for the input parameters of the AutoGPT class.
 */
export interface AutoGPTInput {
  aiName: string;
  aiRole: string;
  memory: VectorStoreRetriever;
  humanInTheLoop?: boolean;
  outputParser?: AutoGPTOutputParser;
  maxIterations?: number;
}

/**
 * Class representing the AutoGPT concept with LangChain primitives. It is
 * designed to be used with a set of tools such as a search tool,
 * write-file tool, and a read-file tool.
 * @example
 * ```typescript
 * const autogpt = AutoGPT.fromLLMAndTools(
 *   new ChatOpenAI({ temperature: 0 }),
 *   [
 *     new ReadFileTool({ store: new InMemoryFileStore() }),
 *     new WriteFileTool({ store: new InMemoryFileStore() }),
 *     new SerpAPI("YOUR_SERPAPI_API_KEY", {
 *       location: "San Francisco,California,United States",
 *       hl: "en",
 *       gl: "us",
 *     }),
 *   ],
 *   {
 *     memory: new MemoryVectorStore(new OpenAIEmbeddings()).asRetriever(),
 *     aiName: "Tom",
 *     aiRole: "Assistant",
 *   },
 * );
 * const result = await autogpt.run(["write a weather report for SF today"]);
 * ```
 */
export class AutoGPT {
  aiName: string;

  memory: VectorStoreRetriever;

  fullMessageHistory: BaseMessage[];

  nextActionCount: number;

  chain: LLMChain;

  outputParser: AutoGPTOutputParser;

  tools: ObjectTool[];

  feedbackTool?: Tool;

  maxIterations: number;

  // Currently not generic enough to support any text splitter.
  textSplitter: TokenTextSplitter;

  constructor({
    aiName,
    memory,
    chain,
    outputParser,
    tools,
    feedbackTool,
    maxIterations,
  }: Omit<Required<AutoGPTInput>, "aiRole" | "humanInTheLoop"> & {
    chain: LLMChain;
    tools: ObjectTool[];
    feedbackTool?: Tool;
  }) {
    this.aiName = aiName;
    this.memory = memory;
    this.fullMessageHistory = [];
    this.nextActionCount = 0;
    this.chain = chain;
    this.outputParser = outputParser;
    this.tools = tools;
    this.feedbackTool = feedbackTool;
    this.maxIterations = maxIterations;
    const chunkSize = getEmbeddingContextSize(
      "modelName" in memory.vectorStore.embeddings
        ? (memory.vectorStore.embeddings.modelName as string)
        : undefined
    );
    this.textSplitter = new TokenTextSplitter({
      chunkSize,
      chunkOverlap: Math.round(chunkSize / 10),
    });
  }

  /**
   * Creates a new AutoGPT instance from a given LLM and a set of tools.
   * @param llm A BaseChatModel object.
   * @param tools An array of ObjectTool objects.
   * @param options.aiName The name of the AI.
   * @param options.aiRole The role of the AI.
   * @param options.memory A VectorStoreRetriever object that represents the memory of the AI.
   * @param options.maxIterations The maximum number of iterations the AI can perform.
   * @param options.outputParser An AutoGPTOutputParser object that parses the output of the AI.
   * @returns A new instance of the AutoGPT class.
   */
  static fromLLMAndTools(
    llm: BaseChatModel,
    tools: ObjectTool[],
    {
      aiName,
      aiRole,
      memory,
      maxIterations = 100,
      // humanInTheLoop = false,
      outputParser = new AutoGPTOutputParser(),
    }: AutoGPTInput
  ): AutoGPT {
    const prompt = new AutoGPTPrompt({
      aiName,
      aiRole,
      tools,
      tokenCounter: llm.getNumTokens.bind(llm),
      sendTokenLimit: getModelContextSize(
        "modelName" in llm ? (llm.modelName as string) : "gpt2"
      ),
    });
    // const feedbackTool = humanInTheLoop ? new HumanInputRun() : null;
    const chain = new LLMChain({ llm, prompt });
    return new AutoGPT({
      aiName,
      memory,
      chain,
      outputParser,
      tools,
      // feedbackTool,
      maxIterations,
    });
  }

  /**
   * Runs the AI with a given set of goals.
   * @param goals An array of strings representing the goals.
   * @returns A string representing the result of the run or undefined if the maximum number of iterations is reached without a result.
   */
  async run(goals: string[]): Promise<string | undefined> {
    const user_input =
      "Determine which next command to use, and respond using the format specified above:";
    let loopCount = 0;
    while (loopCount < this.maxIterations) {
      loopCount += 1;

      const { text: assistantReply } = await this.chain.call({
        goals,
        user_input,
        memory: this.memory,
        messages: this.fullMessageHistory,
      });

      // Print the assistant reply
      console.log(assistantReply);
      this.fullMessageHistory.push(new HumanMessage(user_input));
      this.fullMessageHistory.push(new AIMessage(assistantReply));

      const action = await this.outputParser.parse(assistantReply);
      const tools = this.tools.reduce(
        (acc, tool) => ({ ...acc, [tool.name]: tool }),
        {} as { [key: string]: ObjectTool }
      );
      if (action.name === FINISH_NAME) {
        return action.args.response;
      }
      let result: string;
      if (action.name in tools) {
        const tool = tools[action.name];
        let observation;
        try {
          observation = await tool.call(action.args);
        } catch (e) {
          observation = `Error in args: ${e}`;
        }
        result = `Command ${tool.name} returned: ${observation}`;
      } else if (action.name === "ERROR") {
        result = `Error: ${action.args}. `;
      } else {
        result = `Unknown command '${action.name}'. Please refer to the 'COMMANDS' list for available commands and only respond in the specified JSON format.`;
      }

      let memoryToAdd = `Assistant Reply: ${assistantReply}\nResult: ${result} `;
      if (this.feedbackTool) {
        const feedback = `\n${await this.feedbackTool.call("Input: ")}`;
        if (feedback === "q" || feedback === "stop") {
          console.log("EXITING");
          return "EXITING";
        }
        memoryToAdd += feedback;
      }

      const documents = await this.textSplitter.createDocuments([memoryToAdd]);
      await this.memory.addDocuments(documents);
      this.fullMessageHistory.push(new SystemMessage(result));
    }

    return undefined;
  }
}
