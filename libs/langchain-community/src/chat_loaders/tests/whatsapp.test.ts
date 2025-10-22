import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { WhatsAppChatLoader } from "../whatsapp.js";

test("WhatsAppChatLoader parses WhatsApp export preserving timestamps and senders", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/whatsapp/whatsapp_chat.txt"
  );

  const loader = new WhatsAppChatLoader(filePath);
  const sessions = await loader.load();
  expect(sessions.length).toBe(1);
  const { messages } = sessions[0];
  expect(messages.length).toBeGreaterThan(0);
  // Mirror Python assertion: content contains the macaw sentence
  const first = messages[0];
  expect(first.text).toContain(
    "I spotted a rare Hyacinth Macaw yesterday in the Amazon Rainforest. Such a magnificent creature!"
  );
});
