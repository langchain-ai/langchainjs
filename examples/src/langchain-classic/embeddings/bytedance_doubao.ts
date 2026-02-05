import { ByteDanceDoubaoEmbeddings } from "@langchain/community/embeddings/bytedance_doubao";

const model = new ByteDanceDoubaoEmbeddings({
  model: "ep-xxx-xxx",
});
const res = await model.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
