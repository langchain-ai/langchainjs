import { AlibabaTongyiEmbeddings } from "@langchain/community/embeddings/alibaba_tongyi";

const model = new AlibabaTongyiEmbeddings({});
const res = await model.embedQuery(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
