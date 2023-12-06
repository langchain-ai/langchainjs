import { OpenAI } from "langchain/llms/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SerpAPI } from "langchain/tools";
import { Calculator } from "langchain/tools/calculator";
import { WebBrowser } from "langchain/tools/webbrowser";

export const run = async () => {
  const model = new OpenAI({ temperature: 0 });
  const embeddings = new OpenAIEmbeddings();
  const tools = [
    new SerpAPI(process.env.SERPAPI_API_KEY, {
      location: "Austin,Texas,United States",
      hl: "en",
      gl: "us",
    }),
    new Calculator(),
    new WebBrowser({ model, embeddings }),
  ];

  const executor = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });
  console.log("Loaded agent.");

  const input = `What is the word of the day on merriam webster. What is the top result on google for that word`;

  console.log(`Executing with input "${input}"...`);

  const result = await executor.invoke({ input });
  /*
  Entering new agent_executor chain...
  I need to find the word of the day on Merriam Webster and then search for it on Google
  Action: web-browser
  Action Input: "https://www.merriam-webster.com/word-of-the-day", ""


  Summary: Merriam-Webster is a website that provides users with a variety of resources, including a dictionary, thesaurus, word finder, word of the day, games and quizzes, and more. The website also allows users to log in and save words, view recents, and access their account settings. The Word of the Day for April 14, 2023 is "lackadaisical", which means lacking in life, spirit, or zest. The website also provides quizzes and games to help users build their vocabulary.

  Relevant Links: 
  - [Test Your Vocabulary](https://www.merriam-webster.com/games)
  - [Thesaurus](https://www.merriam-webster.com/thesaurus)
  - [Word Finder](https://www.merriam-webster.com/wordfinder)
  - [Word of the Day](https://www.merriam-webster.com/word-of-the-day)
  - [Shop](https://shop.merriam-webster.com/?utm_source=mwsite&utm_medium=nav&utm_content=
  I now need to search for the word of the day on Google
  Action: search
  Action Input: "lackadaisical"
  lackadaisical implies a carefree indifference marked by half-hearted efforts. lackadaisical college seniors pretending to study. listless suggests a lack of ...
  Finished chain.
  */

  console.log(`Got output ${JSON.stringify(result, null, 2)}`);
  /*
  Got output {
    "output": "The word of the day on Merriam Webster is \"lackadaisical\", which implies a carefree indifference marked by half-hearted efforts.",
    "intermediateSteps": [
      {
        "action": {
          "tool": "web-browser",
          "toolInput": "https://www.merriam-webster.com/word-of-the-day\", ",
          "log": " I need to find the word of the day on Merriam Webster and then search for it on Google\nAction: web-browser\nAction Input: \"https://www.merriam-webster.com/word-of-the-day\", \"\""
        },
        "observation": "\n\nSummary: Merriam-Webster is a website that provides users with a variety of resources, including a dictionary, thesaurus, word finder, word of the day, games and quizzes, and more. The website also allows users to log in and save words, view recents, and access their account settings. The Word of the Day for April 14, 2023 is \"lackadaisical\", which means lacking in life, spirit, or zest. The website also provides quizzes and games to help users build their vocabulary.\n\nRelevant Links: \n- [Test Your Vocabulary](https://www.merriam-webster.com/games)\n- [Thesaurus](https://www.merriam-webster.com/thesaurus)\n- [Word Finder](https://www.merriam-webster.com/wordfinder)\n- [Word of the Day](https://www.merriam-webster.com/word-of-the-day)\n- [Shop](https://shop.merriam-webster.com/?utm_source=mwsite&utm_medium=nav&utm_content="
      },
      {
        "action": {
          "tool": "search",
          "toolInput": "lackadaisical",
          "log": " I now need to search for the word of the day on Google\nAction: search\nAction Input: \"lackadaisical\""
        },
        "observation": "lackadaisical implies a carefree indifference marked by half-hearted efforts. lackadaisical college seniors pretending to study. listless suggests a lack of ..."
      }
    ]
  }
  */
};
