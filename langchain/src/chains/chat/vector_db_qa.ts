// import { BaseChatModel, BaseChatMessage } from "../../chat_models/base.js";
// import { VectorStore } from "../../vectorstores/base.js";
// import { BaseChain, ChainValues } from "../base.js";
// import { ChatQAChain } from "./base.js";
//
// export class ChatChatVectorDBQAChain extends BaseChain {
//   qaChain: ChatQAChain;
//
//   inputKey = "question";
//
//   outputKey = "response";
//
//   vectorStore: VectorStore;
//
//   k = 5;
//
//   get inputKeys() {
//     return [this.inputKey];
//   }
//
//   get outputKeys() {
//     return [this.outputKey];
//   }
//
//   constructor(fields: {
//     vectorStore: VectorStore;
//     qaChain: ChatQAChain;
//     inputKey?: string;
//     outputKey?: string;
//     k?: number;
//   }) {
//     super();
//     this.vectorStore = fields.vectorStore;
//     this.qaChain = fields.qaChain;
//     this.inputKey = fields.inputKey ?? this.inputKey;
//     this.outputKey = fields.outputKey ?? this.outputKey;
//     this.k = fields.k ?? this.k;
//   }
//
//   static fromModel(
//     model: BaseChatModel,
//     vectorStore: VectorStore,
//     starterMessages?: BaseChatMessage[]
//   ) {
//     const qaChain = new ChatQAChain({ model, starterMessages });
//     return new ChatChatVectorDBQAChain({ vectorStore, qaChain });
//   }
//
//   async _call(values: ChainValues): Promise<ChainValues> {
//     const question = values[this.inputKey];
//     const docs = await this.vectorStore.similaritySearch(question, this.k);
//     const result = await this.qaChain.call({
//       [this.qaChain.questionKey]: question,
//       [this.qaChain.documentsKey]: docs,
//     });
//     return { [this.outputKey]: result[this.qaChain.outputKey] };
//   }
//
//   serialize(): SerializedChatQAChain {
//     return {
//       _type: "chat-qa",
//       // TODO: serialize the rest of the fields
//       // model: this.model.serialize(),
//       // prompt: this.prompt.serialize(),
//       // humanPrefix: this.humanPrefix,
//       // aiPrefix: this.aiPrefix,
//     };
//   }
//
//   _chainType() {
//     return "chat-qa" as const;
//   }
// }
//
// export interface SerializedChatQAChain {
//   _type: "chat-qa";
// }
