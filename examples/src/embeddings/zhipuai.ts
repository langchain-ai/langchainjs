import { ZhipuAIEmbeddings } from "@langchain/community/embeddings/zhipuai";

const model = new ZhipuAIEmbeddings({});
const res = await model.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
