import { InMemoryStore } from "langchain/storage/in_memory";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";

// Instantiate the store using the `fromPath` method.
const store = new InMemoryStore<BaseMessage>();
/**
 * Here you would define your LLM and chat chain, call
 * the LLM and eventually get a list of messages.
 * For this example, we'll assume we already have a list.
 */
const messages = Array.from({ length: 5 }).map((_, index) => {
  if (index % 2 === 0) {
    return new AIMessage("ai stuff...");
  }
  return new HumanMessage("human stuff...");
});
// Set your messages in the store
// The key will be prefixed with `message:id:` and end
// with the index.
await store.mset(
  messages.map((message, index) => [`message:id:${index}`, message])
);
// Now you can get your messages from the store
const retrievedMessages = await store.mget(["message:id:0", "message:id:1"]);
console.log(retrievedMessages.map((v) => v));
/**
[
  AIMessage {
    lc_kwargs: { content: 'ai stuff...', additional_kwargs: {} },
    content: 'ai stuff...',
    ...
  },
  HumanMessage {
    lc_kwargs: { content: 'human stuff...', additional_kwargs: {} },
    content: 'human stuff...',
    ...
  }
]
 */
// Or, if you want to get back all the keys you can call
// the `yieldKeys` method.
// Optionally, you can pass a key prefix to only get back
// keys which match that prefix.
const yieldedKeys = [];
for await (const key of store.yieldKeys("message:id:")) {
  yieldedKeys.push(key);
}
// The keys are not encoded, so no decoding is necessary
console.log(yieldedKeys);
/**
[
  'message:id:0',
  'message:id:1',
  'message:id:2',
  'message:id:3',
  'message:id:4'
]
 */
// Finally, let's delete the keys from the store
await store.mdelete(yieldedKeys);
