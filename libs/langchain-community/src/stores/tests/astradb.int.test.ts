/* eslint-disable no-process-env */
import { AstraDB } from "@datastax/astra-db-ts";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { AstraDBChatMessageHistory } from "../message/astradb.js";

let client: AstraDB;

describe.skip("AstraDBChatMessageHistory", () => {
  beforeAll(() => {
    expect(process.env.ASTRA_DB_APPLICATION_TOKEN).toBeDefined();
    expect(process.env.ASTRA_DB_ENDPOINT).toBeDefined();

    client = new AstraDB(
      process.env.ASTRA_DB_APPLICATION_TOKEN,
      process.env.ASTRA_DB_ENDPOINT,
      process.env.ASTRA_DB_NAMESPACE
    );
  });

  beforeEach(async () => {
    try {
      await client.dropCollection("test_messages");
    } catch (e) {
      console.debug("Collection doesn't exist yet, skipping drop");
    }

    await client.createCollection("test_messages");
  });

  test("Test Asta DB Chat History", async () => {
    const collection = await client.collection("test_messages");

    const sessionId = "langchain_test_messages_session";

    const history = new AstraDBChatMessageHistory({ collection, sessionId });

    await history.addUserMessage(
      "What TS client allows me to connect to Astra DB?"
    );
    await history.addAIChatMessage("@datastax/astra-db-ts");

    const expectedMessages = [
      new HumanMessage("What TS client allows me to connect to Astra DB?"),
      new AIMessage("@datastax/astra-db-ts"),
    ];

    const getResults = await history.getMessages();
    expect(getResults).toEqual(expectedMessages);
  });

  test("Test clear Asta DB Chat History", async () => {
    const sessionId = "langchain_test_messages_session";

    // tests creation via static method
    const history = await AstraDBChatMessageHistory.initialize({
      token: process.env.ASTRA_DB_APPLICATION_TOKEN ?? "token",
      endpoint: process.env.ASTRA_DB_ENDPOINT ?? "endpoint",
      collectionName: "test_messages",
      namespace: process.env.ASTRA_DB_NAMESPACE,
      sessionId,
    });

    await history.addUserMessage(
      "What TS client allows me to connect to Astra DB?"
    );
    await history.addAIChatMessage("@datastax/astra-db-ts");

    const expectedMessages = [
      new HumanMessage("What TS client allows me to connect to Astra DB?"),
      new AIMessage("@datastax/astra-db-ts"),
    ];

    const getResults = await history.getMessages();
    expect(getResults).toEqual(expectedMessages);

    await history.clear();

    const emptyResults = await history.getMessages();
    expect(emptyResults).toStrictEqual([]);
  });
});
