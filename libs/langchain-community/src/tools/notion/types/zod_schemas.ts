import { z } from "zod";

// Zod schema for text content used in blocks
export const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.object({
    content: z.string(),
    link: z
      .object({
        url: z.string().url(),
      })
      .optional(),
  }),
});

// Zod schema for a paragraph block
export const paragraphBlockSchema = z.object({
  object: z.literal("block"),
  type: z.literal("paragraph"),
  paragraph: z.object({
    rich_text: z.array(textContentSchema),
  }),
});

// Zod schema for heading blocks (supports heading_1, heading_2, heading_3)
export const headingBlockSchema = z.object({
  object: z.literal("block"),
  type: z.union([
    z.literal("heading_1"),
    z.literal("heading_2"),
    z.literal("heading_3"),
  ]),
  heading_1: z
    .object({
      rich_text: z.array(textContentSchema),
    })
    .optional(),
  heading_2: z
    .object({
      rich_text: z.array(textContentSchema),
    })
    .optional(),
  heading_3: z
    .object({
      rich_text: z.array(textContentSchema),
    })
    .optional(),
});

// Zod schema for Notion blocks (extendable to include more block types)
export const notionBlockSchema = z.union([
  paragraphBlockSchema,
  headingBlockSchema,
]);
