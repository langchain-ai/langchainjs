import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    sessionId: v.string(),
    message: v.object({
      type: v.string(),
      data: v.object({
        content: v.string(),
        role: v.optional(v.string()),
        name: v.optional(v.string()),
        additional_kwargs: v.optional(v.any()),
      }),
    }),
  }).index("bySessionId", ["sessionId"]),
});
