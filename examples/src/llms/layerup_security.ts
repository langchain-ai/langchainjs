import {
  LayerupSecurity,
  LayerupSecurityOptions,
} from "@langchain/community/llms/layerup_security";
import { GuardrailResponse } from "@layerup/layerup-security";
import { OpenAI } from "@langchain/openai";

// Create an instance of your favorite LLM
const openai = new OpenAI({
  modelName: "gpt-3.5-turbo",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Configure Layerup Security
const layerupSecurityOptions: LayerupSecurityOptions = {
  // Specify a LLM that Layerup Security will wrap around
  llm: openai,

  // Layerup API key, from the Layerup dashboard
  layerupApiKey: process.env.LAYERUP_API_KEY,

  // Custom base URL, if self hosting
  layerupApiBaseUrl: "https://api.uselayerup.com/v1",

  // List of guardrails to run on prompts before the LLM is invoked
  promptGuardrails: [],

  // List of guardrails to run on responses from the LLM
  responseGuardrails: ["layerup.hallucination"],

  // Whether or not to mask the prompt for PII & sensitive data before it is sent to the LLM
  mask: false,

  // Metadata for abuse tracking, customer tracking, and scope tracking.
  metadata: { customer: "example@uselayerup.com" },

  // Handler for guardrail violations on the response guardrails
  handlePromptGuardrailViolation: (violation: GuardrailResponse) => {
    if (violation.offending_guardrail === "layerup.sensitive_data") {
      // Custom logic goes here
    }

    return {
      role: "assistant",
      content: `There was sensitive data! I cannot respond. Here's a dynamic canned response. Current date: ${Date.now()}`,
    };
  },

  // Handler for guardrail violations on the response guardrails
  handleResponseGuardrailViolation: (violation: GuardrailResponse) => ({
    role: "assistant",
    content: `Custom canned response with dynamic data! The violation rule was ${violation.offending_guardrail}.`,
  }),
};

const layerupSecurity = new LayerupSecurity(layerupSecurityOptions);
const response = await layerupSecurity.invoke(
  "Summarize this message: my name is Bob Dylan. My SSN is 123-45-6789."
);
