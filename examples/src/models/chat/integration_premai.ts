import { ChatPrem } from "@langchain/community/chat_models/premai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatPrem({
  // In Node.js defaults to process.env.PREM_API_KEY
  apiKey: "YOUR-API-KEY",
  // In Node.js defaults to process.env.PREM_PROJECT_ID
  project_id: "YOUR-PROJECT_ID",
});

console.log(await model.invoke([new HumanMessage("Hello there!")]));
