import { YandexGPT } from "@langchain/yandex";

const model = new YandexGPT();
const res = await model.invoke(['Translate "I love programming" into French.']);
console.log({ res });
