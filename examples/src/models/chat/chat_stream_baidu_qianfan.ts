import { ChatBaiduQianfan } from "@langchain/baidu-qianfan";
import { HumanMessage } from "@langchain/core/messages";

const chat = new ChatBaiduQianfan({
  qianfanAccessKey: process.env.QIANFAN_ACCESS_KEY,
  qianfanSecretKey: process.env.QIANFAN_SECRET_KEY,
  model: "ERNIE-Lite-8K",
  streaming: true,
});

const message = new HumanMessage("等额本金和等额本息有什么区别？");
const res = await chat.invoke([message]);
console.log({ res });

/**
 {
      res: AIMessage {
        lc_serializable: true,
        lc_kwargs: {
          content: 'undefined等额本金和等额本息是两种常见的贷款还款方式，它们之间的主要区别在于计息方式、每月还款额和利息支出等方面。\n' +
            '\n' +
            '1. 计息方式：等额本金是一种按月递减的计息方式，每月偿还相同数额的本金和剩余贷款在该月产生的利息。而等额本息则是每月偿还相同金额的利息，根据贷款金额和贷款期限计算月供，本金和利息在每月还款中占的比例逐月变化。\n' +
            '2. 每月还款额：由于等额本息每月偿还的利息占每月还款总额的比例逐渐减少，导致每月还款额逐渐增加，而等额本金每月偿还的本金相同，因此每月还款额逐渐减少。\n' +
            '3. 利息支出：在贷款期限相同的情况下，等额本金的利息支出相对较少，因为随着本金的减少，剩余贷款产生的利息也相应减少。而等额本息的利息支出则相对较高，因为每月偿还的利息逐渐减少，导致总利息支出相对较高。\n' +
            '\n' +
            '总之，等额本金和等额本息在贷款期限相同的情况下，等额本金由于利息支出相对较少，更适合于资金充裕、有提前还款打算的借款人；而等额本息每月还款额固定，更适合于每月收入较高的借款人。',
          tool_calls: [],
          invalid_tool_calls: [],
          additional_kwargs: {},
          response_metadata: {}
        },
        lc_namespace: [ 'langchain_core', 'messages' ],
        content: 'undefined等额本金和等额本息是两种常见的贷款还款方式，它们之间的主要区别在于计息方式、每月还款额和利息支出等方面。\n' +
          '\n' +
          '1. 计息方式：等额本金是一种按月递减的计息方式，每月偿还相同数额的本金和剩余贷款在该月产生的利息。而等额本息则是每月偿还相同金额的利息，根据贷款金额和贷款期限计算月供，本金和利息在每月还款中占的比例逐月变化。\n' +
          '2. 每月还款额：由于等额本息每月偿还的利息占每月还款总额的比例逐渐减少，导致每月还款额逐渐增加，而等额本金每月偿还的本金相同，因此每月还款额逐渐减少。\n' +
          '3. 利息支出：在贷款期限相同的情况下，等额本金的利息支出相对较少，因为随着本金的减少，剩余贷款产生的利息也相应减少。而等额本息的利息支出则相对较高，因为每月偿还的利息逐渐减少，导致总利息支出相对较高。\n' +
          '\n' +
          '总之，等额本金和等额本息在贷款期限相同的情况下，等额本金由于利息支出相对较少，更适合于资金充裕、有提前还款打算的借款人；而等额本息每月还款额固定，更适合于每月收入较高的借款人。',
        name: undefined,
        additional_kwargs: {},
        response_metadata: { tokenUsage: [Object] },
        tool_calls: [],
        invalid_tool_calls: []
      }
    }
 */
