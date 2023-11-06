import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  cache: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("byKey", ["key"]),
});
