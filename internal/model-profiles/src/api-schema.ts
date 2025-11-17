/**
 * Schema definitions for model and provider types.
 *
 * Adapted from: https://github.com/sst/models.dev/blob/dev/packages/core/src/schema.ts
 *
 * Original source: SST models.dev
 * License: Apache-2.0 (https://github.com/sst/models.dev/blob/dev/LICENSE)
 *
 * This file contains Zod schema definitions for validating model and provider
 * configurations used in the langchain-model-profiles package.
 */

import { z } from "zod/v3";

export const Model = z
  .object({
    id: z.string(),
    name: z.string().min(1, "Model name cannot be empty"),
    attachment: z.boolean(),
    reasoning: z.boolean(),
    tool_call: z.boolean(),
    structured_output: z.boolean().optional(),
    temperature: z.boolean().optional(),
    knowledge: z
      .string()
      .regex(/^\d{4}-\d{2}(-\d{2})?$/, {
        message: "Must be in YYYY-MM or YYYY-MM-DD format",
      })
      .optional(),
    release_date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, {
      message: "Must be in YYYY-MM or YYYY-MM-DD format",
    }),
    last_updated: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, {
      message: "Must be in YYYY-MM or YYYY-MM-DD format",
    }),
    modalities: z.object({
      input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
      output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
    }),
    open_weights: z.boolean(),
    cost: z
      .object({
        input: z.number().min(0, "Input price cannot be negative"),
        output: z.number().min(0, "Output price cannot be negative"),
        reasoning: z
          .number()
          .min(0, "Input price cannot be negative")
          .optional(),
        cache_read: z
          .number()
          .min(0, "Cache read price cannot be negative")
          .optional(),
        cache_write: z
          .number()
          .min(0, "Cache write price cannot be negative")
          .optional(),
        input_audio: z
          .number()
          .min(0, "Audio input price cannot be negative")
          .optional(),
        output_audio: z
          .number()
          .min(0, "Audio output price cannot be negative")
          .optional(),
      })
      .optional(),
    limit: z.object({
      context: z.number().min(0, "Context window must be positive"),
      output: z.number().min(0, "Output tokens must be positive"),
    }),
    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    provider: z
      .object({
        npm: z.string().optional(),
        api: z.string().optional(),
      })
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      return !(data.reasoning === false && data.cost?.reasoning !== undefined);
    },
    {
      message: "Cannot set cost.reasoning when reasoning is false",
      path: ["cost", "reasoning"],
    }
  );

export type Model = z.infer<typeof Model>;

export const Provider = z
  .object({
    id: z.string(),
    env: z.array(z.string()).min(1, "Provider env cannot be empty"),
    npm: z.string().min(1, "Provider npm module cannot be empty"),
    api: z.string().optional(),
    name: z.string().min(1, "Provider name cannot be empty"),
    doc: z
      .string()
      .min(
        1,
        "Please provide a link to the provider documentation where models are listed"
      ),
    models: z.record(Model),
  })
  .strict();

export type Provider = z.infer<typeof Provider>;

export const ProviderMap = z.record(z.string(), Provider);
export type ProviderMap = z.infer<typeof ProviderMap>;
