import { BaseLanguageModel } from "../base_language/index.js";
import {
    getBufferString,
    InputValues,
    MemoryVariables,
    OutputValues,
} from "./base.js";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";

interface BufferMemoryInput extends BaseChatMemoryInput {
    humanPrefix?: string;
    aiPrefix?: string;
    memoryKey?: string;
    maxTokenLimit?: number;
    llm: BaseLanguageModel;
}

export default class ConversationTokenBufferMemory extends BaseChatMemory {
    humanPrefix = "Human";

    aiPrefix = "AI";

    memoryKey = "history";

    maxTokenLimit = 1024;

    llm: BaseLanguageModel;

    constructor(fields: BufferMemoryInput) {
        super({
            chatHistory: fields?.chatHistory,
            returnMessages: fields?.returnMessages ?? false,
            inputKey: fields?.inputKey,
            outputKey: fields?.outputKey,
        });

        this.llm = fields.llm;
        this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
        this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
        this.memoryKey = fields.memoryKey ?? this.memoryKey;

        this.maxTokenLimit = fields.maxTokenLimit || this.maxTokenLimit;
    }

    get memoryKeys() {
        return [this.memoryKey];
    }


    async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
        const messages = await this.chatHistory.getMessages();
        if (this.returnMessages) {
            const result = {
                [this.memoryKey]: messages,
            };
            return result;
        }
        const result = {
            [this.memoryKey]: getBufferString(messages, this.humanPrefix, this.aiPrefix),
        };
        return result;
    }

    /*
    async saveContext(
        inputValues: InputValues,
        outputValues: OutputValues
    ): Promise<void> {
        await super.saveContext(inputValues, outputValues);

        const buffer = await this.chatHistory.getMessages();
        let bufferString = getBufferString(buffer, this.humanPrefix, this.aiPrefix);

        let totalTokensCount = await this.llm.getNumTokens(bufferString);

        if (totalTokensCount > this.maxTokenLimit) {
            const prunedMemory = [];

            while (totalTokensCount > this.maxTokenLimit) {
                prunedMemory.push(buffer.shift());

                bufferString = getBufferString(buffer, this.humanPrefix, this.aiPrefix);
                totalTokensCount = await this.llm.getNumTokens(bufferString);
            }
        }
    }
    */

    async saveContext(
        inputValues: InputValues,
        outputValues: OutputValues
    ): Promise<void> {
        await super.saveContext(inputValues, outputValues);

        const buffer = await this.chatHistory.getMessages();
        let bufferString = getBufferString(buffer, this.humanPrefix, this.aiPrefix);
        
        let totalTokensCount = await this.llm.getNumTokens(bufferString);
        
        // Binary window approach to find the largest buffer of messages that fits within the maxTokenLimit
        if (totalTokensCount > this.maxTokenLimit) {
            let prunedMemory;
            let sliceIndex = Math.floor(buffer.length / 2);
            let safeWindowTokenCount = 0;

            let windowStartIndex = Math.floor(buffer.length / 2),
                windowEndIndex = buffer.length;

            while (windowStartIndex < windowEndIndex && windowStartIndex >= 0) {
                const newBufferWindow = buffer.slice(windowStartIndex, windowEndIndex);

                if (newBufferWindow.length >= 1) {
                    const bufferString = getBufferString(newBufferWindow, this.humanPrefix, this.aiPrefix);
                    const newWindowTokensCount = await this.llm.getNumTokens(bufferString);

                    const _safeWindowTokenCount = (safeWindowTokenCount + newWindowTokensCount);

                    if (_safeWindowTokenCount === this.maxTokenLimit) {
                        safeWindowTokenCount += _safeWindowTokenCount;
                        break;
                    } else if (_safeWindowTokenCount < this.maxTokenLimit) {
                        safeWindowTokenCount += _safeWindowTokenCount;
                        sliceIndex = windowStartIndex;

                        windowEndIndex = windowStartIndex;
                        windowStartIndex = Math.floor(windowStartIndex / 2);
                    } else {
                        windowStartIndex = Math.ceil((windowEndIndex + windowStartIndex) / 2);
                    }
                }
            }

            prunedMemory = buffer.splice(0, sliceIndex);
        }
    }
}
