import { ChatIflytekXinghuo } from "@langchain/community/chat_models/iflytek_xinghuo";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatIflytekXinghuo();

const messages1 = [new HumanMessage("Nice to meet you!")];

const res1 = await model.invoke(messages1);

console.log(res1);

const messages2 = [new HumanMessage("Hello")];

const res2 = await model.invoke(messages2);

console.log(res2);
