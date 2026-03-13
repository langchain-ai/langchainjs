import { HumanMessage } from "@langchain/core/messages";
import { ChatIflytekXinghuo } from "../iflytek_xinghuo/index.js";

test.skip("Iflytek Xinghuo Call", async () => {
  const model = new ChatIflytekXinghuo({
    iflytekAppid: "",
    iflytekApiKey: "",
    iflytekApiSecret: "",
  });
  const messages = [new HumanMessage("Nice to meet you!")];
  await model.invoke(messages);
});
