import { YandexGPT } from "@langchain/community/llms/yandex";

const model = new YandexGPT();

const res = await model.call('Translate "I love programming" into French.');

console.log({ res });
