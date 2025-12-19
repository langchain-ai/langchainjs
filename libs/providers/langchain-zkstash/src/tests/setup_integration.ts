import { fromApiKey } from "@zkstash/sdk/rest";
import { z } from "zod";

const apiKey = process.env.ZKSTASH_API_KEY;
if (!apiKey) {
  console.error("ZKSTASH_API_KEY not set");
  process.exit(1);
}

const client = fromApiKey(apiKey);

async function setup() {
  try {
    console.log("Setting up schemas for integration tests...");
    
    const schemas = [
      {
        name: "user_preferences",
        description: "User preferences like name and favorite things.",
        schema: z.object({
          name: z.string().optional(),
          preference: z.string(),
        }),
      },
      {
        name: "facts",
        description: "General facts about the world or the user.",
        schema: z.object({
          fact: z.string(),
        }),
      },
      {
        name: "storage",
        description: "Generic key-value storage schema.",
        schema: z.object({
          key: z.string(),
          value: z.any(),
        }),
      }
    ];

    for (const s of schemas) {
      try {
        console.log(`Registering schema: ${s.name}...`);
        await client.registerSchema(s.name, s.schema, { description: s.description });
        console.log(`Successfully registered schema: ${s.name}`);
      } catch (e: any) {
        if (e.message.includes("409")) {
          console.log(`Schema ${s.name} already exists.`);
        } else {
          console.error(`Error registering ${s.name}:`, e.message);
        }
      }
    }
    
    console.log("Setup completed.");
  } catch (e) {
    console.error("Setup failed:", e);
  }
}

setup();
