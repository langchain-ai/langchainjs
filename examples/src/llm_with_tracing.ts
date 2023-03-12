import { OpenAI } from "langchain/llms";
import { ChatOpenAI } from "langchain/chat_models";
import {SystemChatMessage, HumanChatMessage} from "langchain/schema";
import * as process from "process";

export const run = async () => {
    process.env.LANGCHAIN_HANDLER = "langchain";
    const model = new OpenAI({ temperature: 0.9 });
    let res = await model.call(
        "What would be a good company name a company that makes colorful socks?"
    );
    console.log({ res });

    const chat = new ChatOpenAI({ temperature: 0 });
    const system_message = new SystemChatMessage("You are to chat with a user.");
    const message = new HumanChatMessage("Hello!");
    res = await chat.call([system_message, message]);
    console.log({ res });
};
