import * as hanaClient from "@sap/hana-client";
import { HanaDB, HanaDBArgs } from "../hanavector.js";
import { OpenAIEmbeddings } from "@langchain/openai";

// Connection parameters
const connectionParams = {
  host: process.env.HOST,
  port: process.env.PORT,
  uid: process.env.UID,
  pwd: process.env.PWD,
};
const client = hanaClient.createConnection();
// Connect to the database
client.connect(connectionParams);
const args: HanaDBArgs = {
  connection: client,
  tableName: "test2",
};
test("Test HanaDB.fromTexts + addVectors", async () => {
  const vectorStore = await HanaDB.fromTexts(
    ["foo", "bar", "baz"],
    [{ page: 1 }, { page: 2 }, { page: 3 }],
    new OpenAIEmbeddings(),
    args
  );
});
