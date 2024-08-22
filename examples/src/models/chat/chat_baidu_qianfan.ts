import { ChatBaiduQianfan } from "@langchain/baidu-qianfan";
import { HumanMessage } from "@langchain/core/messages";

const chat = new ChatBaiduQianfan({
  qianfanAccessKey: process.env.QIANFAN_ACCESS_KEY,
  qianfanSecretKey: process.env.QIANFAN_SECRET_KEY,
  model: "ERNIE-Lite-8K",
});

const message = new HumanMessage("北京天气");
const res = await chat.invoke([message]);
console.log({ res });
/**
    {
      res: AIMessage {
        lc_serializable: true,
        lc_kwargs: {
          content: '北京天气**多云，气温13~24°C**，微风，空气质量良，预报无持续降水^[2]^。\n' +
            '\n' +
            '近期天气情况来说，白天最高气温多在30度左右，而夜晚最低气温仅有几度，早晚较凉，需要做好保暖，昼夜温差较大。由于现在正处于雨水节气，此时天气阴沉、多变，时而下起冰雹，时而下起大雨，天色昏暗。冰雹时间不会持续太长，通常都是下冰雹一小段时间后就会停止，天气就会逐渐恢复晴好^[1]^。',
          tool_calls: [],
          invalid_tool_calls: [],
          additional_kwargs: {},
          response_metadata: {}
        },
        lc_namespace: [ 'langchain_core', 'messages' ],
        content: '北京天气**多云，气温13~24°C**，微风，空气质量良，预报无持续降水^[2]^。\n' +
          '\n' +
          '近期天气情况来说，白天最高气温多在30度左右，而夜晚最低气温仅有几度，早晚较凉，需要做好保暖，昼夜温差较大。由于现在正处于雨水节气，此时天气阴沉、多变，时而下起冰雹，时而下起大雨，天色昏暗。冰雹时间不会持续太长，通常都是下冰雹一小段时间后就会停止，天气就会逐渐恢复晴好^[1]^。',
        name: undefined,
        additional_kwargs: {},
        response_metadata: { tokenUsage: [Object] },
        tool_calls: [],
        invalid_tool_calls: []
      }
    }
 */
