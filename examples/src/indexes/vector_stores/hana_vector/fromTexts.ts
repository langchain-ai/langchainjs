import hanaClient from "@sap/hana-client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { setTimeout } from "timers/promises";
import { HanaDB, HanaDBArgs} from "@langchain/community/vectorstores/hanavector";

const connectionParams = {
    host: process.env.HANA_HOST,
    port: process.env.HANA_PORT,
    uid: process.env.HANA_UID,
    pwd: process.env.HANA_PWD,
};
const embeddings = new OpenAIEmbeddings();
//connet to hanaDB
const client = hanaClient.createConnection();
client.connect(connectionParams);
// define instance args
const args: HanaDBArgs = {
connection: client,
tableName: "test",
};
const vectorStore = await HanaDB.fromTexts(
    ["Bye bye", "Hello world", "hello nice world"],
    [
      { id: 2, name: "2" },
      { id: 1, name: "1" },
      { id: 3, name: "3" },
    ],
    embeddings,
    args
    );

// sleep 5 seconds to make sure the documents are indexed.
await setTimeout(5000);

const response = await vectorStore.similaritySearch("hello world", 2);

console.log(response);

/*
[
  { pageContent: 'Hello world', metadata: { id: 1, name: '1' } },
  { pageContent: 'hello nice world', metadata: { id: 3, name: '3' } }
]
*/
