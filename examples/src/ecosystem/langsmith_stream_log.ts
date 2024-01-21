import { RemoteRunnable } from "langchain/runnables/remote";
import { applyPatch } from "@langchain/core/utils/json_patch";

const remoteChain = new RemoteRunnable({
  url: "https://your_hostname.com/path",
});

const logStream = await remoteChain.streamLog(
  {
    param1: "param1",
    param2: "param2",
  },
  // LangChain runnable config properties
  {
    configurable: {
      llm: "some_property",
    },
    metadata: {
      conversation_id: "other_metadata",
    },
  },
  // Optional additional streamLog properties for filtering outputs
  {
    includeNames: [],
    includeTags: [],
    includeTypes: [],
    excludeNames: [],
    excludeTags: [],
    excludeTypes: [],
  }
);

let streamedResponse: Record<string, any> = {};

for await (const chunk of logStream) {
  console.log(chunk);
  streamedResponse = applyPatch(streamedResponse, chunk.ops).newDocument;
}

console.log(streamedResponse);
