import { OVHcloudAIEndpointsEmbeddings } from "@langchain/community/embeddings/ovhcloud";

/* Embed queries */
const ovhcloudEmbeddings = new OVHcloudAIEndpointsEmbeddings();
const res = await ovhcloudEmbeddings.embedQuery("Hello world");

console.log(res);

/* Embed documents */
const documentRes = await ovhcloudEmbeddings.embedDocuments([
  "Hello world",
  "Bye bye",
]);

console.log(documentRes);
