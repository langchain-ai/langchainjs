// yarn test:single src/experimental/masking/tests/masking-extended.test.ts
import { MaskingParser, RegexMaskingTransformer } from "../index.js";

// Mock database for simulating state storage and retrieval
const mockDB = (() => {
  const db = new Map<string, string>();
  return {
    async saveState(key: string, serializedState: string) {
      db.set(key, serializedState);
    },
    async getState(key: string): Promise<string> {
      return db.get(key) || "";
    },
  };
})();

function serializeState(state: Map<string, string>): string {
  return JSON.stringify(Array.from(state.entries()));
}

function deserializeState(serializedState: string): Map<string, string> {
  return new Map(JSON.parse(serializedState));
}

describe("MaskingParser Integration Test", () => {
  let parser: MaskingParser;
  let transformer: RegexMaskingTransformer;
  const emailPattern = { regex: /\S+@\S+\.\S+/, replacement: "[email]" };
  const phonePattern = { regex: /\d{3}-\d{3}-\d{4}/, replacement: "[phone]" };

  beforeEach(() => {
    transformer = new RegexMaskingTransformer({
      email: emailPattern,
      phone: phonePattern,
    });

    parser = new MaskingParser();
    parser.addTransformer(transformer);
  });

  it("should mask, store state, and rehydrate with altered order", async () => {
    const originalMessage = "Contact me at jane.doe@email.com or 555-123-4567.";
    const maskedMessage = await parser.mask(originalMessage);

    // Serialize and store the state
    const serializedState = serializeState(parser.getState());
    await mockDB.saveState("uniqueMessageId", serializedState);

    // Simulate retrieving and altering the masked message
    // Here, we assume the AI processing reverses the order of masked content
    // Simulate retrieving and altering the masked message
    const alteredMaskedMessage = maskedMessage.split(" ").reverse().join(" ");

    // Retrieve and deserialize the state
    const retrievedSerializedState = await mockDB.getState("uniqueMessageId");
    const retrievedState = deserializeState(retrievedSerializedState);

    // Rehydrate the altered message
    const rehydratedMessage = await parser.rehydrate(
      alteredMaskedMessage,
      retrievedState
    );

    // The expectation depends on how the alteration affects the masked message.
    // Here, we assume that the rehydrated message should match the original message
    // even after the alteration since the masked content still aligns with the stored state.
    const expectedRehydratedMessage = originalMessage
      .split(" ")
      .reverse()
      .join(" ");
    expect(rehydratedMessage).toEqual(expectedRehydratedMessage);
  });
});
