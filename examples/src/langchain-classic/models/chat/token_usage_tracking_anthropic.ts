import { ChatAnthropic } from "@langchain/anthropic";

const chatModel = new ChatAnthropic({
  model: "claude-3-sonnet-20240229",
});

const res = await chatModel.invoke("Tell me a joke.");

console.log(res.response_metadata);

/*
  {
    id: 'msg_017Mgz6HdgNbi3cwL1LNB9Dw',
    model: 'claude-3-sonnet-20240229',
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 30 },
    stop_reason: 'end_turn'
  }
*/
