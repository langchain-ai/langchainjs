// in nodejs environment
import { TencentHunyuanEmbeddings } from "@langchain/community/embeddings/tencent_hunyuan";

// in browser environment
// import { TencentHunyuanEmbeddings } from "@langchain/community/embeddings/tencent_hunyuan/web";

export const run = async () => {
  /* Embed queries */
  const embeddings = new TencentHunyuanEmbeddings();
  const res = await embeddings.embedQuery("你好，世界！");
  console.log(res);
  /* Embed documents */
  const documentRes = await embeddings.embedDocuments(["你好，世界！", "再见"]);
  console.log({ documentRes });
};
