import { OpenAI } from "langchain/llms/openai";
import { loadSummarizationChain } from "langchain/chains";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from "fs";

export const run = async () => {
  // In this example, we use a `MapReduceDocumentsChain` specifically prompted to summarize a set of documents.
  const text = fs.readFileSync("state_of_the_union.txt", "utf8");
  const model = new OpenAI({ temperature: 0 });
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([text]);

  // This convenience function creates a document chain prompted to summarize a set of documents.
  const chain = loadSummarizationChain(model, {
    type: "map_reduce",
    returnIntermediateSteps: true,
  });
  const res = await chain.call({
    input_documents: docs,
  });
  console.log({ res });
  /*
  {
    res: {
      intermediateSteps: [
        "In response to Russia's aggression in Ukraine, the United States has united with other freedom-loving nations to impose economic sanctions and hold Putin accountable. The U.S. Department of Justice is also assembling a task force to go after the crimes of Russian oligarchs and seize their ill-gotten gains.",
        "The United States and its European allies are taking action to punish Russia for its invasion of Ukraine, including seizing assets, closing off airspace, and providing economic and military assistance to Ukraine. The US is also mobilizing forces to protect NATO countries and has released 30 million barrels of oil from its Strategic Petroleum Reserve to help blunt gas prices. The world is uniting in support of Ukraine and democracy, and the US stands with its Ukrainian-American citizens.",
        " President Biden and Vice President Harris ran for office with a new economic vision for America, and have since passed the American Rescue Plan and the Bipartisan Infrastructure Law to help struggling families and rebuild America's infrastructure. This includes creating jobs, modernizing roads, airports, ports, and waterways, replacing lead pipes, providing affordable high-speed internet, and investing in American products to support American jobs.",
      ],
      text: "President Biden is taking action to protect Americans from the COVID-19 pandemic and Russian aggression, providing economic relief, investing in infrastructure, creating jobs, and fighting inflation.
        He is also proposing measures to reduce the cost of prescription drugs, protect voting rights, and reform the immigration system. The speaker is advocating for increased economic security, police reform, and the Equality Act, as well as providing support for veterans and military families.
        The US is making progress in the fight against COVID-19, and the speaker is encouraging Americans to come together and work towards a brighter future.",
    },
  }
  */
};
