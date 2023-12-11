import { v } from "convex/values";
import { ConvexKVStore } from "../../../convex.js";
import { action, mutation } from "./_generated/server.js";

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("cache").collect();
    await Promise.all(documents.map((document) => ctx.db.delete(document._id)));
  },
});

export const mset = action({
  args: {
    pairs: v.array(v.object({ key: v.string(), value: v.any() })),
  },
  handler: async (ctx, { pairs }) => {
    await new ConvexKVStore({ ctx }).mset(
      pairs.map(({ key, value }) => [key, value])
    );
  },
});

export const mget = action({
  args: {
    keys: v.array(v.string()),
  },
  handler: async (ctx, { keys }) => {
    const results = await new ConvexKVStore({ ctx }).mget(keys);
    // Convex only allows `null`s over the wire, so to make sure we're returning
    // `undefined`s, map them to strings
    return results.map((result) =>
      result === undefined ? "undefined" : result
    );
  },
});

export const mdelete = action({
  args: {
    keys: v.array(v.string()),
  },
  handler: async (ctx, { keys }) => {
    await new ConvexKVStore({ ctx }).mdelete(keys);
  },
});
