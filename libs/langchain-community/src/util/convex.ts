/* eslint-disable spaced-comment */

// eslint-disable-next-line import/no-extraneous-dependencies
import {
  internalQueryGeneric as internalQuery,
  internalMutationGeneric as internalMutation,
} from "convex/server";
// eslint-disable-next-line import/no-extraneous-dependencies
import { GenericId, v } from "convex/values";

export const get = /*#__PURE__*/ internalQuery({
  args: {
    id: /*#__PURE__*/ v.string(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.id as GenericId<string>);
    return result;
  },
});

export const insert = /*#__PURE__*/ internalMutation({
  args: {
    table: /*#__PURE__*/ v.string(),
    document: /*#__PURE__*/ v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert(args.table, args.document);
  },
});

export const lookup = /*#__PURE__*/ internalQuery({
  args: {
    table: /*#__PURE__*/ v.string(),
    index: /*#__PURE__*/ v.string(),
    keyField: /*#__PURE__*/ v.string(),
    key: /*#__PURE__*/ v.string(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query(args.table)
      .withIndex(args.index, (q) => q.eq(args.keyField, args.key))
      .collect();
    return result;
  },
});

export const upsert = /*#__PURE__*/ internalMutation({
  args: {
    table: /*#__PURE__*/ v.string(),
    index: /*#__PURE__*/ v.string(),
    keyField: /*#__PURE__*/ v.string(),
    key: /*#__PURE__*/ v.string(),
    document: /*#__PURE__*/ v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(args.table)
      .withIndex(args.index, (q) => q.eq(args.keyField, args.key))
      .unique();
    if (existing !== null) {
      await ctx.db.replace(existing._id, args.document);
    } else {
      await ctx.db.insert(args.table, args.document);
    }
  },
});

export const deleteMany = /*#__PURE__*/ internalMutation({
  args: {
    table: /*#__PURE__*/ v.string(),
    index: /*#__PURE__*/ v.string(),
    keyField: /*#__PURE__*/ v.string(),
    key: /*#__PURE__*/ v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query(args.table)
      .withIndex(args.index, (q) => q.eq(args.keyField, args.key))
      .collect();
    await Promise.all(existing.map((doc) => ctx.db.delete(doc._id)));
  },
});
