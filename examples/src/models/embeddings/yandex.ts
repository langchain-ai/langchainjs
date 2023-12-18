import { YandexGPTEmbeddings } from "@langchain/community/embeddings/yandex";

const model = new YandexGPTEmbeddings({});

/* Embed queries */
const res = await model.embedQuery(
    "This is a test document."
);
console.log({ res });
/* Embed documents */
const documentRes = await model.embedDocuments(["This is a test document."]);
console.log({ documentRes });
