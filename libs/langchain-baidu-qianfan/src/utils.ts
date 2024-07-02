/**
 * 对话请求公共服务模型列表
 */
export type ChatModel =
    | 'ERNIE-4.0-8K'
    | 'ERNIE-3.5-8K'
    | 'ERNIE-3.5-8K-0205'
    | 'ERNIE-3.5-8K-1222'
    | 'ERNIE-3.5-4K-0205'
    | 'ERNIE-Speed-128K'
    | 'ERNIE-Lite-8K-0922'
    | 'ERNIE-Lite-8K-0308'
    | 'ERNIE Speed-AppBuilder'
    | 'Gemma-7B-it'
    | 'Mixtral-8x7B-Instruct'
    | 'ERNIE-Bot-turbo'
    | 'ERNIE-Bot'
    | 'ERNIE-Bot-4'
    | 'ERNIE-Bot-8k'
    | 'ERNIE-Speed'
    | 'EB-turbo-AppBuilder'
    | 'BLOOMZ-7B'
    | 'Llama-2-7b-chat'
    | 'Llama-2-13b-chat'
    | 'Llama-2-70b-chat'
    | 'Qianfan-BLOOMZ-7B-compressed'
    | 'Qianfan-Chinese-Llama-2-7B'
    | 'ChatGLM2-6B-32K'
    | 'AquilaChat-7B'
    | 'XuanYuan-70B-Chat-4bit'
    | 'Qianfan-Chinese-Llama-2-13B'
    | 'ChatLaw'
    | 'SQLCoder-7B'
    | 'CodeLlama-7b-Instruct'
    | 'Yi-34B-Chat'

export const CHAT_MODEL = [
    "ERNIE-4.0-8K",
    "ERNIE-3.5-8K",
    "ERNIE-3.5-8K-0205",
    "ERNIE-3.5-8K-1222",
    "ERNIE-3.5-4K-0205",
    "ERNIE-Speed-128K",
    "ERNIE-Lite-8K-0922",
    "ERNIE-Lite-8K-0308",
    "ERNIE Speed-AppBuilder",
    "Gemma-7B-it",
    "Mixtral-8x7B-Instruct",
    "ERNIE-Bot-turbo",
    "ERNIE-Bot",
    "ERNIE-Bot-4",
    "ERNIE-Bot-8k",
    "ERNIE-Speed",
    "EB-turbo-AppBuilder",
    "BLOOMZ-7B",
    "Llama-2-7b-chat",
    "Llama-2-13b-chat",
    "Llama-2-70b-chat",
    "Qianfan-BLOOMZ-7B-compressed",
    "Qianfan-Chinese-Llama-2-7B",
    "ChatGLM2-6B-32K",
    "AquilaChat-7B",
    "XuanYuan-70B-Chat-4bit",
    "Qianfan-Chinese-Llama-2-13B",
    "ChatLaw",
    "SQLCoder-7B",
    "CodeLlama-7b-Instruct",
    "Yi-34B-Chat",
];


export const isValidModel = (modelName: string) : boolean => {
    return CHAT_MODEL.includes(modelName);
}

