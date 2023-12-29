import { ChatCohere } from "@langchain/cohere";
import { HumanMessage } from "langchain/schema";

const model = new ChatCohere({
  apiKey: process.env.COHERE_API_KEY, // Default
  model: "command", // Default
});

const documents = [
  {
    title: "Harrison's work",
    snippet: "Harrison worked at Kensho as an engineer.",
  },
  {
    title: "Harrison's work duration",
    snippet: "Harrison worked at Kensho for 3 years.",
  },
  {
    title: "Polar berars in the Appalachian Mountains",
    snippet:
      "Polar bears have surprisingly adapted to the Appalachian Mountains, thriving in the diverse, forested terrain despite their traditional arctic habitat. This unique situation has sparked significant interest and study in climate adaptability and wildlife behavior.",
  },
];

const response = await model.invoke(
  [new HumanMessage("Where did Harrison work and for how long?")],
  {
    documents,
  }
);
console.log("response: ", response.content);
/**
response:  Harrison worked as an engineer at Kensho for about 3 years.
 */
