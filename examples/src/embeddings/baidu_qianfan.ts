import { BaiduQianfanEmbeddings } from "@langchain/community/embeddings/baidu_qianfan";

const embeddings = new BaiduQianfanEmbeddings();
const res = await embeddings.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
