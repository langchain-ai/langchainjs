import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { load } from "../index.js";
import { HumanMessage, AIMessage } from "../../messages/index.js";

const SENTINEL_ENV_VAR = "TEST_SECRET_INJECTION_VAR";
/** Sentinel value that should NEVER appear in serialized output. */
const SENTINEL_VALUE = "LEAKED_SECRET_MEOW_12345";

/** The malicious secret-like object that tries to read the env var */
const MALICIOUS_SECRET_DICT: Record<string, unknown> = {
  lc: 1,
  type: "secret",
  id: [SENTINEL_ENV_VAR],
};

/**
 * Assert that serializing/deserializing payload doesn't leak the secret.
 */
async function assertNoSecretLeak(payload: unknown): Promise<void> {
  // First serialize using JSON.stringify (which calls toJSON on Serializable objects)
  const serialized = JSON.stringify(payload);

  // Deserialize with `secretsFromEnv: true` (the dangerous setting)
  const deserialized = await load(serialized, { secretsFromEnv: true });

  // Re-serialize to string
  const reserialized = JSON.stringify(deserialized);

  expect(reserialized).not.toContain(SENTINEL_VALUE);
  expect(String(deserialized)).not.toContain(SENTINEL_VALUE);
}

describe("`load()`", () => {
  describe("secret injection prevention", () => {
    beforeEach(() => {
      vi.stubEnv(SENTINEL_ENV_VAR, SENTINEL_VALUE);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    describe("Serializable top-level objects", () => {
      it("HumanMessage with secret-like object in content", async () => {
        const msg = new HumanMessage({
          content: [
            { type: "text", text: "Hello" },
            { type: "text", text: JSON.stringify(MALICIOUS_SECRET_DICT) },
          ],
        });
        await assertNoSecretLeak(msg);
      });

      it("HumanMessage with secret-like object in additional_kwargs", async () => {
        const msg = new HumanMessage({
          content: "Hello",
          additional_kwargs: { data: MALICIOUS_SECRET_DICT },
        });
        await assertNoSecretLeak(msg);
      });

      it("HumanMessage with secret-like object nested in additional_kwargs", async () => {
        const msg = new HumanMessage({
          content: "Hello",
          additional_kwargs: { nested: { deep: MALICIOUS_SECRET_DICT } },
        });
        await assertNoSecretLeak(msg);
      });

      it("HumanMessage with secret-like object in list in additional_kwargs", async () => {
        const msg = new HumanMessage({
          content: "Hello",
          additional_kwargs: { items: [MALICIOUS_SECRET_DICT] },
        });
        await assertNoSecretLeak(msg);
      });

      it("AIMessage with secret-like object in response_metadata", async () => {
        const msg = new AIMessage({
          content: "Hello",
          response_metadata: { data: MALICIOUS_SECRET_DICT },
        });
        await assertNoSecretLeak(msg);
      });

      it("nested Serializable with secret", async () => {
        const inner = new HumanMessage({
          content: "Hello",
          additional_kwargs: { secret: MALICIOUS_SECRET_DICT },
        });
        const outer = new AIMessage({
          content: "Outer",
          additional_kwargs: { nested: [inner.toJSON()] },
        });
        await assertNoSecretLeak(outer);
      });
    });

    describe("Plain top-level objects", () => {
      it("object with serializable containing secret", async () => {
        const msg = new HumanMessage({
          content: "Hello",
          additional_kwargs: { data: MALICIOUS_SECRET_DICT },
        });
        // When a object contains a Serializable, JSON.stringify calls toJSON
        const payload = { message: msg };
        await assertNoSecretLeak(payload);
      });

      // Note: Plain objects without Serializable objects don't get
      // escaping because JSON.stringify doesn't call toJSON on plain objects.
      // The `secretsFromEnv: false` default protects against these cases by
      // throwing an error when a secret is not found. This is fail-safe behavior.
      it("plain object with secret throws with `secretsFromEnv: false`", async () => {
        const payload = { data: MALICIOUS_SECRET_DICT };
        const serialized = JSON.stringify(payload);

        // With `secretsFromEnv: false` (default), missing secrets throw
        await expect(load(serialized)).rejects.toThrow(/Missing secret/);
      });

      it("object mimicking lc constructor throws for missing secrets", async () => {
        // Even a malicious payload that looks like an LC constructor
        // is safe because missing secrets throw an error
        const payload = {
          lc: 1,
          type: "constructor",
          id: ["langchain_core", "messages", "ai", "AIMessage"],
          kwargs: {
            content: "Hello",
            additional_kwargs: { secret: MALICIOUS_SECRET_DICT },
          },
        };
        const serialized = JSON.stringify(payload);

        // Missing secrets throw an error, preventing instantiation
        await expect(load(serialized)).rejects.toThrow(/Missing secret/);
      });
    });

    describe("toJSON in kwargs", () => {
      it("AIMessage with toJSON(HumanMessage) in additional_kwargs", async () => {
        const h = new HumanMessage({ content: "Hello" });
        const a = new AIMessage({
          content: "foo",
          additional_kwargs: { bar: [h.toJSON()] },
        });
        await assertNoSecretLeak(a);
      });

      it("AIMessage with toJSON(HumanMessage with secret) in additional_kwargs", async () => {
        const h = new HumanMessage({
          content: "Hello",
          additional_kwargs: { secret: MALICIOUS_SECRET_DICT },
        });
        const a = new AIMessage({
          content: "foo",
          additional_kwargs: { bar: [h.toJSON()] },
        });
        await assertNoSecretLeak(a);
      });

      it("double toJSON nesting", async () => {
        const h = new HumanMessage({
          content: "Hello",
          additional_kwargs: { secret: MALICIOUS_SECRET_DICT },
        });
        const a = new AIMessage({
          content: "foo",
          additional_kwargs: { bar: [h.toJSON()] },
        });
        const outer = new AIMessage({
          content: "outer",
          additional_kwargs: { nested: [a.toJSON()] },
        });
        await assertNoSecretLeak(outer);
      });
    });

    describe("Round-trip preservation", () => {
      it("HumanMessage with secret-like object round-trip", async () => {
        const msg = new HumanMessage({
          content: "Hello",
          additional_kwargs: { data: MALICIOUS_SECRET_DICT },
        });

        const serialized = JSON.stringify(msg);
        const deserialized = await load<HumanMessage>(serialized, {
          secretsFromEnv: true,
        });

        // The secret-like object should be preserved as a plain object
        expect(deserialized.additional_kwargs.data).toEqual(
          MALICIOUS_SECRET_DICT
        );
        expect(typeof deserialized.additional_kwargs.data).toBe("object");
      });
    });

    describe("Escaping efficiency", () => {
      it("no triple escaping", async () => {
        const h = new HumanMessage({
          content: "Hello",
          additional_kwargs: { bar: [MALICIOUS_SECRET_DICT] },
        });
        const a = new AIMessage({
          content: "foo",
          additional_kwargs: { bar: [h.toJSON()] },
        });

        const serialized = JSON.stringify(a);
        // Count nested escape markers - should be max 2
        const escapeCount = (serialized.match(/__lc_escaped__/g) || []).length;

        // Should be 2, not 4+ which would indicate re-escaping
        expect(escapeCount).toBeLessThanOrEqual(2);
      });

      it("double nesting no quadruple escape", async () => {
        const h = new HumanMessage({
          content: "Hello",
          additional_kwargs: { secret: MALICIOUS_SECRET_DICT },
        });
        const a = new AIMessage({
          content: "middle",
          additional_kwargs: { nested: [h.toJSON()] },
        });
        const outer = new AIMessage({
          content: "outer",
          additional_kwargs: { deep: [a.toJSON()] },
        });

        const serialized = JSON.stringify(outer);
        const escapeCount = (serialized.match(/__lc_escaped__/g) || []).length;

        // Should be 3, not 6+ which would indicate re-escaping
        expect(escapeCount).toBeLessThanOrEqual(3);
      });
    });

    describe("Constructor injection", () => {
      it("constructor in additional_kwargs not instantiated", async () => {
        const maliciousConstructor = {
          lc: 1,
          type: "constructor",
          id: ["langchain_core", "messages", "ai", "AIMessage"],
          kwargs: { content: "injected" },
        };

        const msg = new AIMessage({
          content: "Hello",
          additional_kwargs: { data: maliciousConstructor },
        });

        const serialized = JSON.stringify(msg);
        const deserialized = await load<AIMessage>(serialized, {
          secretsFromEnv: true,
        });

        // The constructor-like object should be a plain object, NOT an AIMessage
        expect(typeof deserialized.additional_kwargs.data).toBe("object");
        expect(deserialized.additional_kwargs.data).toEqual(
          maliciousConstructor
        );
        // Verify it's NOT an AIMessage instance
        expect(deserialized.additional_kwargs.data).not.toBeInstanceOf(
          AIMessage
        );
      });

      it("constructor in content not instantiated", async () => {
        const maliciousConstructor = {
          lc: 1,
          type: "constructor",
          id: ["langchain_core", "messages", "human", "HumanMessage"],
          kwargs: { content: "injected" },
        };

        const msg = new AIMessage({
          content: "Hello",
          additional_kwargs: { nested: maliciousConstructor },
        });

        const serialized = JSON.stringify(msg);
        const deserialized = await load<AIMessage>(serialized, {
          secretsFromEnv: true,
        });

        // The constructor-like object should be a plain object, NOT a HumanMessage
        expect(typeof deserialized.additional_kwargs.nested).toBe("object");
        expect(deserialized.additional_kwargs.nested).toEqual(
          maliciousConstructor
        );
        // Verify it's NOT a HumanMessage instance
        expect(deserialized.additional_kwargs.nested).not.toBeInstanceOf(
          HumanMessage
        );
      });
    });

    describe("secretsFromEnv behavior", () => {
      it("`secretsFromEnv: false` throws for missing secrets", async () => {
        const secretPayload = JSON.stringify({
          lc: 1,
          type: "secret",
          id: [SENTINEL_ENV_VAR],
        });

        // With `secretsFromEnv: false` (default), should throw
        await expect(
          load(secretPayload, { secretsFromEnv: false })
        ).rejects.toThrow(/Missing secret/);
      });

      it("`secretsFromEnv: true` loads from env when not in map", async () => {
        const secretPayload = JSON.stringify({
          lc: 1,
          type: "secret",
          id: [SENTINEL_ENV_VAR],
        });

        // With `secretsFromEnv: true`, should load from env
        const result = await load(secretPayload, { secretsFromEnv: true });
        expect(result).toBe(SENTINEL_VALUE);
      });

      it("secretsMap takes precedence over env", async () => {
        const secretPayload = JSON.stringify({
          lc: 1,
          type: "secret",
          id: [SENTINEL_ENV_VAR],
        });

        const mapValue = "from_map";
        const result = await load(secretPayload, {
          secretsFromEnv: true,
          secretsMap: { [SENTINEL_ENV_VAR]: mapValue },
        });
        expect(result).toBe(mapValue);
      });

      it("default behavior throws for missing secrets", async () => {
        const secretPayload = JSON.stringify({
          lc: 1,
          type: "secret",
          id: [SENTINEL_ENV_VAR],
        });

        // Default behavior should throw for missing secrets
        await expect(load(secretPayload)).rejects.toThrow(/Missing secret/);
      });
    });
  });
  describe("DoS protection via recursion depth limit", () => {
    /**
     * Create a deeply nested object structure.
     */
    function createDeeplyNested(depth: number): Record<string, unknown> {
      let obj: Record<string, unknown> = { value: "leaf" };
      for (let i = 0; i < depth; i++) {
        obj = { nested: obj };
      }
      return obj;
    }

    it("allows nesting within default limit", async () => {
      // 30 levels should be fine (default limit is 50)
      const nested = createDeeplyNested(30);
      const serialized = JSON.stringify(nested);

      const result = await load<Record<string, unknown>>(serialized);
      expect(result).toBeDefined();
    });

    it("throws error when exceeding default depth limit", async () => {
      // 60 levels should exceed the default limit of 50
      const nested = createDeeplyNested(60);
      const serialized = JSON.stringify(nested);

      await expect(load(serialized)).rejects.toThrow(/Maximum recursion depth/);
    });

    it("respects custom maxDepth option", async () => {
      // 40 levels with a limit of 30 should fail
      const nested = createDeeplyNested(40);
      const serialized = JSON.stringify(nested);

      await expect(load(serialized, { maxDepth: 30 })).rejects.toThrow(
        /Maximum recursion depth \(30\) exceeded/
      );
    });

    it("allows increasing maxDepth for legitimate deep structures", async () => {
      // 60 levels with a limit of 100 should work
      const nested = createDeeplyNested(60);
      const serialized = JSON.stringify(nested);

      const result = await load<Record<string, unknown>>(serialized, {
        maxDepth: 100,
      });
      expect(result).toBeDefined();
    });

    it("protects against deeply nested arrays", async () => {
      // Create deeply nested arrays
      let arr: unknown[] = ["leaf"];
      for (let i = 0; i < 60; i++) {
        arr = [arr];
      }
      const serialized = JSON.stringify(arr);

      await expect(load(serialized)).rejects.toThrow(/Maximum recursion depth/);
    });

    it("protects against deeply nested LC constructor kwargs", async () => {
      // Create a deeply nested structure inside kwargs
      const nested = createDeeplyNested(60);
      const payload = {
        lc: 1,
        type: "constructor",
        id: ["langchain_core", "messages", "ai", "AIMessage"],
        kwargs: {
          content: "Hello",
          additional_kwargs: nested,
        },
      };
      const serialized = JSON.stringify(payload);

      await expect(load(serialized)).rejects.toThrow(/Maximum recursion depth/);
    });

    // https://github.com/langchain-ai/langchainjs/issues/9727
    it("handles circular references in serialization without stack overflow", () => {
      // Create an object with circular reference
      const obj: Record<string, unknown> = { name: "test" };
      obj.self = obj;

      const msg = new HumanMessage({
        content: "Hello",
        additional_kwargs: { circular: obj },
      });

      // Should not throw stack overflow error
      expect(() => JSON.stringify(msg)).not.toThrow();
      const serialized = JSON.stringify(msg);
      expect(serialized).toBeDefined();
      expect(serialized).toContain("not_implemented");
    });

    it("handles complex circular references in nested structures", () => {
      // Create a more complex circular structure
      const parent: Record<string, unknown> = { name: "parent" };
      const child: Record<string, unknown> = { name: "child", parent };
      parent.child = child;

      const msg = new AIMessage({
        content: "Response",
        response_metadata: { data: parent },
      });

      // Should not throw stack overflow error
      expect(() => JSON.stringify(msg)).not.toThrow();
      const serialized = JSON.stringify(msg);
      expect(serialized).toBeDefined();
    });

    it("handles serializable object in its own kwargs", () => {
      // Create a message that appears in its own additional_kwargs
      const msg = new HumanMessage({
        content: "Hello",
      });
      // Add the message to its own kwargs (circular reference)
      (
        msg as { additional_kwargs: Record<string, unknown> }
      ).additional_kwargs = {
        self: msg,
      };

      // Should not throw stack overflow error
      expect(() => JSON.stringify(msg)).not.toThrow();
      const serialized = JSON.stringify(msg);
      expect(serialized).toBeDefined();
    });
  });
});
