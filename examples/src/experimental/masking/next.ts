// app/api/chat

import {
  MaskingParser,
  RegexMaskingTransformer,
} from "langchain/experimental/masking";
import { PromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { BytesOutputParser } from "langchain/schema/output_parser";

export const runtime = "edge";

// Function to format chat messages for consistency
const formatMessage = (message: any) => `${message.role}: ${message.content}`;

const CUSTOMER_SUPPORT = `You are a customer support summarizer agent. Always include masked PII in your response.
  Current conversation:
  {chat_history}
  User: {input}
  AI:`;

// Configure Masking Parser
const maskingParser = new MaskingParser();
// Define transformations for masking emails and phone numbers using regular expressions
const piiMaskingTransformer = new RegexMaskingTransformer({
  email: { regex: /\S+@\S+\.\S+/g }, // If a regex is provided without a mask we fallback to a simple default hashing function
  phone: { regex: /\d{3}-\d{3}-\d{4}/g },
});

maskingParser.addTransformer(piiMaskingTransformer);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content; // Extract the content of the last message
    // Mask sensitive information in the current message
    const guardedMessageContent = await maskingParser.mask(
      currentMessageContent
    );
    // Mask sensitive information in the chat history
    const guardedHistory = await maskingParser.mask(
      formattedPreviousMessages.join("\n")
    );

    const prompt = PromptTemplate.fromTemplate(CUSTOMER_SUPPORT);
    const model = new ChatOpenAI({ temperature: 0.8 });
    // Initialize an output parser that handles serialization and byte-encoding for streaming
    const outputParser = new BytesOutputParser();
    const chain = prompt.pipe(model).pipe(outputParser); // Chain the prompt, model, and output parser together

    console.log("[GUARDED INPUT]", guardedMessageContent); // Contact me at -1157967895 or -1626926859.
    console.log("[GUARDED HISTORY]", guardedHistory); // user: Contact me at -1157967895 or -1626926859. assistant: Thank you for providing your contact information.
    console.log("[STATE]", maskingParser.getState()); // { '-1157967895' => 'jane.doe@email.com', '-1626926859' => '555-123-4567'}

    // Stream the AI response based on the masked chat history and current message
    const stream = await chain.stream({
      chat_history: guardedHistory,
      input: guardedMessageContent,
    });

    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: {
        "content-type": "application/json",
      },
    });
  }
}
