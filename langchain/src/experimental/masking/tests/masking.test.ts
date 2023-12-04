//  yarn test:single src/experimental/masking/tests/masking.test.ts
import { MaskingParser, RegexMaskingTransformer } from "../index.js";
import { jest } from "@jest/globals";

describe("MaskingParser and PIIMaskingTransformer", () => {
  describe("Masking with Static Identifiers", () => {
    let maskingParser: MaskingParser;
    let piiMaskingTransformer: RegexMaskingTransformer;
    const emailPattern = { regex: /\S+@\S+\.\S+/, replacement: "[email]" };
    const phonePattern = { regex: /\d{3}-\d{3}-\d{4}/, replacement: "[phone]" };

    beforeEach(() => {
      piiMaskingTransformer = new RegexMaskingTransformer({
        email: emailPattern,
        phone: phonePattern,
      });

      maskingParser = new MaskingParser();
      maskingParser.addTransformer(piiMaskingTransformer);
    });

    it("masks single occurrences of PII with static identifiers", async () => {
      const message = "Contact me at jane.doe@email.com or 555-123-4567.";
      const expectedMaskedMessage = "Contact me at [email] or [phone].";

      const maskedMessage = await maskingParser.parse(message);

      expect(maskedMessage).toBe(expectedMaskedMessage);
    });

    it("rehydrates static masked data to its original form", async () => {
      const maskedMessage = "Contact me at [email] or [phone].";
      const expectedOriginalMessage =
        "Contact me at jane.doe@email.com or 555-123-4567.";

      await maskingParser.parse(expectedOriginalMessage); // Masking original message
      const rehydratedMessage = await maskingParser.rehydrate(maskedMessage);

      expect(rehydratedMessage).toBe(expectedOriginalMessage);
    });

    function generateLargeMessage() {
      let largeMessage = "";
      for (let i = 0; i < 10000; i++) {
        // Adjust the number for desired message size
        largeMessage += `User${i}: jane.doe${i}@email.com, 555-123-${i
          .toString()
          .padStart(4, "0")}. `;
      }
      return largeMessage;
    }

    describe("Performance Testing", () => {
      it("efficiently processes large data sets", async () => {
        const largeMessage = generateLargeMessage();
        const startTime = performance.now();
        const maskedMessage = await maskingParser.parse(largeMessage);
        const endTime = performance.now();

        const someAcceptableDuration = 5000; // Set this to a duration you consider acceptable, e.g., 5000 milliseconds (5 seconds)

        expect(maskedMessage).toBeDefined();
        expect(endTime - startTime).toBeLessThan(someAcceptableDuration);
      });
    });
  });

  describe("Masking with Dynamic Identifiers", () => {
    let maskingParser: MaskingParser;
    let piiMaskingTransformer: RegexMaskingTransformer;
    const emailMask = () => `[email-${Math.random().toString(16).slice(2)}]`;
    const phoneMask = () => `[phone-${Math.random().toString(16).slice(2)}]`;

    beforeEach(() => {
      piiMaskingTransformer = new RegexMaskingTransformer({
        email: { regex: /\S+@\S+\.\S+/g, mask: emailMask },
        phone: { regex: /\d{3}-\d{3}-\d{4}/g, mask: phoneMask },
      });

      maskingParser = new MaskingParser();
      maskingParser.addTransformer(piiMaskingTransformer);
    });

    it("masks multiple occurrences of different PII with unique identifiers", async () => {
      const message =
        "Contact me at jane.doe@email.com or 555-123-4567. Also reach me at john.smith@email.com";
      const maskedMessage = await maskingParser.parse(message);

      expect(maskedMessage).toMatch(/\[email-[a-f0-9]+\]/g);
      expect(maskedMessage).toMatch(/\[phone-[a-f0-9]+\]/g);
      expect((maskedMessage.match(/\[email-[a-f0-9]+\]/g) || []).length).toBe(
        2
      );
      expect((maskedMessage.match(/\[phone-[a-f0-9]+\]/g) || []).length).toBe(
        1
      );
    });

    it("rehydrates dynamic masked data to its original form", async () => {
      const originalMessage =
        "Contact me at jane.doe@email.com or 555-123-4567. Also reach me at john.smith@email.com";
      const maskedMessage = await maskingParser.parse(originalMessage);
      const rehydratedMessage = await maskingParser.rehydrate(maskedMessage);

      expect(rehydratedMessage).toBe(originalMessage);
    });

    it("masks identical PII with consistent dynamic identifiers", async () => {
      const message =
        "Contact me at jane.doe@email.com or 555-123-4567. Also reach me at john.smith@email.com and 555-123-4567";
      const maskedMessage = await maskingParser.parse(message);

      expect(maskedMessage).toMatch(/\[email-[a-f0-9]+\]/g);
      expect(maskedMessage).toMatch(/\[phone-[a-f0-9]+\]/g);
      expect((maskedMessage.match(/\[email-[a-f0-9]+\]/g) || []).length).toBe(
        2
      );
      expect((maskedMessage.match(/\[phone-[a-f0-9]+\]/g) || []).length).toBe(
        2
      );
    });
  });

  describe("PIIMaskingTransformer with Default Hash Function", () => {
    let maskingParser: MaskingParser;
    let piiMaskingTransformer: RegexMaskingTransformer;
    const emailPattern = { regex: /\S+@\S+\.\S+/, replacement: "[email]" };
    const phonePattern = { regex: /\d{3}-\d{3}-\d{4}/, replacement: "[phone]" };

    beforeEach(() => {
      piiMaskingTransformer = new RegexMaskingTransformer({
        email: emailPattern,
        phone: phonePattern,
      });

      maskingParser = new MaskingParser();
      maskingParser.addTransformer(piiMaskingTransformer);
    });

    it("should mask email and phone using default hash function", async () => {
      const piiMaskingTransformer = new RegexMaskingTransformer({
        email: emailPattern,
        phone: phonePattern,
      });
      const maskingParser = new MaskingParser();
      maskingParser.addTransformer(piiMaskingTransformer);

      const message =
        "My email is jane.doe@email.com and phone is 555-123-4567.";
      const maskedMessage = await maskingParser.parse(message);

      expect(maskedMessage).toContain("[email]");
      expect(maskedMessage).toContain("[phone]");
    });
  });

  describe("PIIMaskingTransformer with Custom Hash Function", () => {
    const emailPattern = { regex: /\S+@\S+\.\S+/, replacement: "[email]" };
    const phonePattern = { regex: /\d{3}-\d{3}-\d{4}/, replacement: "[phone]" };

    let maskingParser: MaskingParser;
    let piiMaskingTransformer: RegexMaskingTransformer;

    beforeEach(() => {
      piiMaskingTransformer = new RegexMaskingTransformer({
        email: emailPattern,
        phone: phonePattern,
      });

      maskingParser = new MaskingParser();
      maskingParser.addTransformer(piiMaskingTransformer);
    });

    const customHashFunction = (input: string) => {
      // A simple hash function that creates a mock hash representation of the input.
      // This is just for demonstration purposes and not a secure hashing method.
      return input
        .split("")
        .map(() => "*")
        .join("");
    };
    it("should mask email and phone using custom hash function", async () => {
      const piiMaskingTransformer = new RegexMaskingTransformer(
        {
          email: {
            regex: /\S+@\S+\.\S+/,
            mask: (match) => `custom-email-${customHashFunction(match)}`,
          },
          phone: {
            regex: /\d{3}-\d{3}-\d{4}/,
            mask: (match) => `custom-phone-${customHashFunction(match)}`,
          },
        },
        customHashFunction
      );

      const maskingParser = new MaskingParser();
      maskingParser.addTransformer(piiMaskingTransformer);

      const message = "Contact me at jane.doe@email.com or 555-123-4567.";
      const maskedMessage = await maskingParser.parse(message);

      // The lengths of the masked parts should be equal to the lengths of the original email and phone number.
      const expectedEmailMask =
        "custom-email-" + "*".repeat("jane.doe@email.com".length);
      const expectedPhoneMask =
        "custom-phone-" + "*".repeat("555-123-4567".length);

      expect(maskedMessage).toContain(expectedEmailMask);
      expect(maskedMessage).toContain(expectedPhoneMask);
    });

    it("should rehydrate masked data correctly using custom hash function", async () => {
      const piiMaskingTransformer = new RegexMaskingTransformer(
        {
          email: {
            regex: /\S+@\S+\.\S+/,
            mask: (match) => `custom-email-${customHashFunction(match)}`,
          },
          phone: {
            regex: /\d{3}-\d{3}-\d{4}/,
            mask: (match) => `custom-phone-${customHashFunction(match)}`,
          },
        },
        customHashFunction
      );

      maskingParser.addTransformer(piiMaskingTransformer);

      const originalMessage =
        "Contact me at jane.doe@email.com or 555-123-4567.";
      const maskedMessage = await maskingParser.parse(originalMessage);
      const rehydratedMessage = await maskingParser.rehydrate(maskedMessage);

      expect(rehydratedMessage).toBe(originalMessage);
    });
  });

  describe("Error Handling in MaskingParser", () => {
    let maskingParser: MaskingParser;
    let piiMaskingTransformer: RegexMaskingTransformer;

    beforeEach(() => {
      piiMaskingTransformer = new RegexMaskingTransformer({});
      maskingParser = new MaskingParser();
    });

    it("throws an error when no transformers are added and parse is called", async () => {
      const message = "Some message";
      await expect(maskingParser.parse(message)).rejects.toThrow(
        "MaskingParser.parse Error: No transformers have been added. Please add at least one transformer before parsing."
      );
    });

    it("throws an error when no transformers are added and rehydrate is called", async () => {
      const message = "Some masked message";
      await expect(maskingParser.rehydrate(message)).rejects.toThrow(
        "MaskingParser.rehydrate Error: No transformers have been added. Please add at least one transformer before rehydrating."
      );
    });

    it("throws an error for invalid message type in parse", async () => {
      const invalidMessage: any = 123; // intentionally incorrect type
      maskingParser.addTransformer(piiMaskingTransformer); // Add a transformer
      await expect(maskingParser.parse(invalidMessage)).rejects.toThrow(
        "The 'message' argument must be a string."
      );
    });

    it("throws an error for invalid message type in rehydrate", async () => {
      const invalidMessage: any = 123; // intentionally incorrect type
      await expect(maskingParser.rehydrate(invalidMessage)).rejects.toThrow(
        "The 'message' argument must be a string."
      );
    });
  });

  describe("Error Handling in PIIMaskingTransformer", () => {
    it("throws an error for invalid message type in transform", () => {
      const transformer = new RegexMaskingTransformer({});
      const invalidMessage: any = 123; // intentionally incorrect type
      const state = new Map<string, string>();
      expect(() => transformer.transform(invalidMessage, state)).toThrow(
        "The 'message' argument must be a string."
      );
    });

    it("throws an error for invalid state type in transform", () => {
      const transformer = new RegexMaskingTransformer({});
      const message = "Some message";
      const invalidState: any = {}; // intentionally incorrect type
      expect(() => transformer.transform(message, invalidState)).toThrow(
        "The 'state' argument must be an instance of Map."
      );
    });

    it("throws an error when initialized with invalid regex pattern", () => {
      expect(() => {
        // @ts-expect-error
        new RegexMaskingTransformer({ invalid: { regex: null } });
      }).toThrow("Invalid pattern configuration.");
    });
  });

  describe("MaskingParser Hooks", () => {
    let maskingParser: MaskingParser;
    let piiMaskingTransformer: RegexMaskingTransformer;
    const emailPattern = { regex: /\S+@\S+\.\S+/, replacement: "[email]" };

    beforeEach(() => {
      piiMaskingTransformer = new RegexMaskingTransformer({
        email: emailPattern,
      });
    });

    it("calls onMaskingStart and onMaskingEnd hooks during parse", async () => {
      const onMaskingStart = jest.fn();
      const onMaskingEnd = jest.fn();

      maskingParser = new MaskingParser({
        transformers: [piiMaskingTransformer],
        onMaskingStart,
        onMaskingEnd,
      });

      const message = "Contact me at jane.doe@email.com";
      await maskingParser.parse(message);

      expect(onMaskingStart).toHaveBeenCalledWith(message);
      expect(onMaskingEnd).toHaveBeenCalled();
    });

    it("calls onRehydratingStart and onRehydratingEnd hooks during rehydrate", async () => {
      const onRehydratingStart = jest.fn();
      const onRehydratingEnd = jest.fn();

      maskingParser = new MaskingParser({
        transformers: [piiMaskingTransformer],
        onRehydratingStart,
        onRehydratingEnd,
      });

      const message = "Contact me at [email]";
      await maskingParser.parse(message); // necessary to populate the state
      await maskingParser.rehydrate(message);

      expect(onRehydratingStart).toHaveBeenCalledWith(message);
      expect(onRehydratingEnd).toHaveBeenCalled();
    });
  });
});
