import {
  MaskingParser,
  RegexMaskingTransformer,
} from "langchain/experimental/masking";

// Define masking strategy
const emailMask = () => `[email-${Math.random().toString(16).slice(2)}]`;
const phoneMask = () => `[phone-${Math.random().toString(16).slice(2)}]`;

// Configure pii transformer
const piiMaskingTransformer = new RegexMaskingTransformer({
  email: { regex: /\S+@\S+\.\S+/g, mask: emailMask },
  phone: { regex: /\d{3}-\d{3}-\d{4}/g, mask: phoneMask },
});

const maskingParser = new MaskingParser({
  transformers: [piiMaskingTransformer],
});
maskingParser.addTransformer(piiMaskingTransformer);

const input =
  "Contact me at jane.doe@email.com or 555-123-4567. Also reach me at john.smith@email.com";
const masked = await maskingParser.mask(input);

console.log(masked);
// Contact me at [email-a31e486e324f6] or [phone-da8fc1584f224]. Also reach me at [email-d5b6237633d95]

const rehydrated = await maskingParser.rehydrate(masked);
console.log(rehydrated);
// Contact me at jane.doe@email.com or 555-123-4567. Also reach me at john.smith@email.com
