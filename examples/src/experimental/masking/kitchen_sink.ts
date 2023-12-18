import {
  MaskingParser,
  RegexMaskingTransformer,
} from "langchain/experimental/masking";

// A simple hash function for demonstration purposes
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}

const emailMask = (match: string) => `[email-${simpleHash(match)}]`;
const phoneMask = (match: string) => `[phone-${simpleHash(match)}]`;
const nameMask = (match: string) => `[name-${simpleHash(match)}]`;
const ssnMask = (match: string) => `[ssn-${simpleHash(match)}]`;
const creditCardMask = (match: string) => `[creditcard-${simpleHash(match)}]`;
const passportMask = (match: string) => `[passport-${simpleHash(match)}]`;
const licenseMask = (match: string) => `[license-${simpleHash(match)}]`;
const addressMask = (match: string) => `[address-${simpleHash(match)}]`;
const dobMask = (match: string) => `[dob-${simpleHash(match)}]`;
const bankAccountMask = (match: string) => `[bankaccount-${simpleHash(match)}]`;

// Regular expressions for different types of PII
const patterns = {
  email: { regex: /\S+@\S+\.\S+/g, mask: emailMask },
  phone: { regex: /\b\d{3}-\d{3}-\d{4}\b/g, mask: phoneMask },
  name: { regex: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, mask: nameMask },
  ssn: { regex: /\b\d{3}-\d{2}-\d{4}\b/g, mask: ssnMask },
  creditCard: { regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, mask: creditCardMask },
  passport: { regex: /(?i)\b[A-Z]{1,2}\d{6,9}\b/g, mask: passportMask },
  license: { regex: /(?i)\b[A-Z]{1,2}\d{6,8}\b/g, mask: licenseMask },
  address: {
    regex: /\b\d{1,5}\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)\*\b/g,
    mask: addressMask,
  },
  dob: { regex: /\b\d{4}-\d{2}-\d{2}\b/g, mask: dobMask },
  bankAccount: { regex: /\b\d{8,17}\b/g, mask: bankAccountMask },
};

// Create a RegexMaskingTransformer with multiple patterns
const piiMaskingTransformer = new RegexMaskingTransformer(patterns);

// Hooks for different stages of masking and rehydrating
const onMaskingStart = (message: string) =>
  console.log(`Starting to mask message: ${message}`);
const onMaskingEnd = (maskedMessage: string) =>
  console.log(`Masked message: ${maskedMessage}`);
const onRehydratingStart = (message: string) =>
  console.log(`Starting to rehydrate message: ${message}`);
const onRehydratingEnd = (rehydratedMessage: string) =>
  console.log(`Rehydrated message: ${rehydratedMessage}`);

// Initialize MaskingParser with the transformer and hooks
const maskingParser = new MaskingParser({
  transformers: [piiMaskingTransformer],
  onMaskingStart,
  onMaskingEnd,
  onRehydratingStart,
  onRehydratingEnd,
});

// Example message containing multiple types of PII
const message =
  "Contact Jane Doe at jane.doe@email.com or 555-123-4567. Her SSN is 123-45-6789 and her credit card number is 1234-5678-9012-3456. Passport number: AB1234567, Driver's License: X1234567, Address: 123 Main St, Date of Birth: 1990-01-01, Bank Account: 12345678901234567.";

// Mask and rehydrate the message
maskingParser
  .mask(message)
  .then((maskedMessage: string) => {
    console.log(`Masked message: ${maskedMessage}`);
    return maskingParser.rehydrate(maskedMessage);
  })
  .then((rehydratedMessage: string) => {
    console.log(`Final rehydrated message: ${rehydratedMessage}`);
  });
