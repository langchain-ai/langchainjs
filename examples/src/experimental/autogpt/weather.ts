import { AutoGPT } from "langchain/experimental/autogpt";
import { ReadFileTool, WriteFileTool, SerpAPI } from "langchain/tools";
import { NodeFileStore } from "langchain/stores/file/node";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";

const store = new NodeFileStore();

const tools = [
  new ReadFileTool({ store }),
  new WriteFileTool({ store }),
  new SerpAPI(process.env.SERPAPI_API_KEY, {
    location: "San Francisco,California,United States",
    hl: "en",
    gl: "us",
  }),
];

const vectorStore = new HNSWLib(new OpenAIEmbeddings(), {
  space: "cosine",
  numDimensions: 1536,
});

const autogpt = AutoGPT.fromLLMAndTools(
  new ChatOpenAI({ temperature: 0 }),
  tools,
  {
    memory: vectorStore.asRetriever(),
    aiName: "Tom",
    aiRole: "Assistant",
  }
);

await autogpt.run(["write a weather report for SF today"]);
/*
{
    "thoughts": {
        "text": "I need to write a weather report for SF today. I should use a search engine to find the current weather conditions.",
        "reasoning": "I don't have the current weather information for SF in my short term memory, so I need to use a search engine to find it.",
        "plan": "- Use the search command to find the current weather conditions for SF\n- Write a weather report based on the information found",
        "criticism": "I need to make sure that the information I find is accurate and up-to-date.",
        "speak": "I will use the search command to find the current weather conditions for SF."
    },
    "command": {
        "name": "search",
        "args": {
            "input": "current weather conditions San Francisco"
        }
    }
}
{
    "thoughts": {
        "text": "I have found the current weather conditions for SF. I need to write a weather report based on this information.",
        "reasoning": "I have the information I need to write a weather report, so I should use the write_file command to save it to a file.",
        "plan": "- Use the write_file command to save the weather report to a file",
        "criticism": "I need to make sure that the weather report is clear and concise.",
        "speak": "I will use the write_file command to save the weather report to a file."
    },
    "command": {
        "name": "write_file",
        "args": {
            "file_path": "weather_report.txt",
            "text": "San Francisco Weather Report:\n\nMorning: 53°, Chance of Rain 1%\nAfternoon: 59°, Chance of Rain 0%\nEvening: 52°, Chance of Rain 3%\nOvernight: 48°, Chance of Rain 2%"
        }
    }
}
{
    "thoughts": {
        "text": "I have completed all my objectives. I will use the finish command to signal that I am done.",
        "reasoning": "I have completed the task of writing a weather report for SF today, so I don't need to do anything else.",
        "plan": "- Use the finish command to signal that I am done",
        "criticism": "I need to make sure that I have completed all my objectives before using the finish command.",
        "speak": "I will use the finish command to signal that I am done."
    },
    "command": {
        "name": "finish",
        "args": {
            "response": "I have completed all my objectives."
        }
    }
}
*/
