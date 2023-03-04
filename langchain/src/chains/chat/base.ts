// import { BaseChain, ChainValues } from "../base.js";
// import { BaseChatModel, ChatMessage, Role } from "../../chat_models/base.js";
// import { ChatMemory } from "../../memory/chat_memory.js";
// // import { BasePromptTemplate } from "../../prompts/index.js";
// import { Document } from "../../document.js";
//
// export interface ChatChainInput {
//   humanPrefix: Role;
//   aiPrefix: Role;
// }
//
// function getDefaultStartMessages() {
//   return [
//     {
//       role: "system",
//       text: `You are a chatbot optimized for question answering.
//         Your job is to answer the most recent user question based
//         ONLY on the information they have told you before.
//         Do NOT use other information than what is provided in previous
//         messages by the human.`,
//     },
//   ];
// }
//
// export class ChatQAChain extends BaseChain implements ChatChainInput {
//   humanPrefix: Role = "user";
//
//   aiPrefix: Role = "assistant";
//
//   declare memory: ChatMemory;
//
//   model: BaseChatModel;
//
//   // prompt: BasePromptTemplate;
//
//   questionKey = "question";
//
//   documentsKey = "input_documents";
//
//   outputKey = "response";
//
//   starterMessages: ChatMessage[] = [];
//
//   get inputKeys() {
//     return [this.questionKey, this.documentsKey];
//   }
//
//   get outputKeys() {
//     return [this.outputKey];
//   }
//
//   constructor(fields: {
//     model: BaseChatModel;
//     // prompt: BasePromptTemplate;
//     humanPrefix?: Role;
//     aiPrefix?: Role;
//     starterMessages?: ChatMessage[];
//     memory?: ChatMemory;
//   }) {
//     super();
//     this.model = fields.model;
//     // this.prompt = fields.prompt;
//     this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
//     this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
//     this.starterMessages = fields.starterMessages ?? getDefaultStartMessages();
//     this.memory =
//       fields.memory ??
//       new ChatMemory({
//         humanPrefix: this.humanPrefix,
//         aiPrefix: this.aiPrefix,
//         messages: this.starterMessages,
//         inputKey: this.questionKey,
//         outputKey: this.outputKey,
//       });
//   }
//
//   static fromModel(model: BaseChatModel, starterMessages: ChatMessage[]) {
//     return new ChatQAChain({ model, starterMessages });
//   }
//
//   async _call(values: ChainValues): Promise<ChainValues> {
//     const newMessage: ChatMessage = {
//       role: this.humanPrefix,
//       text: values[this.questionKey],
//     };
//     const docs = values[this.documentsKey];
//     const docMessages: ChatMessage[] = docs.map((doc: Document) => ({
//       role: this.humanPrefix,
//       text: doc.pageContent,
//     }));
//     const messages = [...this.starterMessages, ...docMessages, newMessage];
//     const output = await this.model.call(messages);
//     return { [this.outputKey]: output };
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
