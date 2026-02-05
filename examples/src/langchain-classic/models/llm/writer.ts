import { Writer } from "@langchain/community/llms/writer";

const model = new Writer({
  maxTokens: 20,
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.WRITER_API_KEY
  orgId: "YOUR-ORGANIZATION-ID", // In Node.js defaults to process.env.WRITER_ORG_ID
});
const res = await model.invoke(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
