import { z } from "zod";
import {
  Client,
  fromJsonSchema,
  type CancelledNotificationParams,
  type ElicitRequest,
  type ElicitResult,
  type JSONRPCNotification,
  type MessageExtraInfo,
} from "@modelcontextprotocol/client";
import {
  CancelledNotificationParamsSchema,
  ElicitRequestFormParamsSchema,
  ElicitRequestSchema,
  ElicitRequestURLParamsSchema,
  ElicitResultSchema,
} from "@modelcontextprotocol/core";
import { DefaultJsonSchemaValidator } from "@modelcontextprotocol/client/_shims";

/** Observe validated cancellations without replacing the SDK handler. */
export class CancellationObserverMCPClient extends Client {
  constructor(
    info: ConstructorParameters<typeof Client>[0],
    options: ConstructorParameters<typeof Client>[1],
    private readonly onCancelled?: (
      notification: CancelledNotificationParams
    ) => void | Promise<void>
  ) {
    super(info, options);
  }

  protected override _onnotification(
    notification: JSONRPCNotification,
    extra?: MessageExtraInfo
  ): void {
    // The SDK aborts the in-flight request from this notification. Dispatch it
    // first so observing a cancellation can never suppress that.
    super._onnotification(notification, extra);

    if (notification.method !== "notifications/cancelled") return;

    const parsed = CancelledNotificationParamsSchema.safeParse(
      notification.params
    );
    if (
      !parsed.success ||
      (this.getProtocolEra() === "modern" &&
        parsed.data.requestId === undefined)
    )
      return;

    try {
      Promise.resolve(this.onCancelled?.(parsed.data)).catch(() => {});
    } catch {
      // Observer failures must not affect SDK cancellation dispatch.
    }
  }
}

export const elicitationAnswerSchema = ElicitResultSchema;

export const modernElicitationAnswerSchema = ElicitResultSchema.pick({
  action: true,
  content: true,
}).strip();

// Keep the modern question fields from the SDK's legacy-compatible schemas.
const modernFormRequestSchema = ElicitRequestFormParamsSchema.pick({
  mode: true,
  message: true,
  requestedSchema: true,
});

const modernURLRequestSchema = ElicitRequestURLParamsSchema.pick({
  mode: true,
  message: true,
  url: true,
});

export const modernElicitationRequestSchema = ElicitRequestSchema.extend({
  params: z.union([modernFormRequestSchema, modernURLRequestSchema]),
}).transform((request) => request.params);

type ModernElicitationRequest = z.output<typeof modernElicitationRequestSchema>;

/** SDK-owned form or URL request. The application owns presentation. */
export type MCPElicitationRequest = ElicitRequest["params"];

export type MCPElicitationAnswer = ElicitResult;

export interface MCPElicitationContext {
  /** Configured server name. */
  server: string;
  /** Aborted when the originating request is cancelled. */
  signal: AbortSignal;
}

export type MCPElicitationHandler = (
  request: MCPElicitationRequest,
  context: MCPElicitationContext
) => MCPElicitationAnswer | Promise<MCPElicitationAnswer>;

/** Parse application answers without duplicating the protocol's schemas. */
export function elicitationAnswerFor(
  request: MCPElicitationRequest | ModernElicitationRequest,
  schema: z.ZodType<ElicitResult> = elicitationAnswerSchema
) {
  return schema.check(async (ctx) => {
    const answer = ctx.value;

    if (request.mode === "url") {
      if (answer.content !== undefined) {
        ctx.issues.push({
          code: "custom",
          input: answer,
          path: ["content"],
          message: "URL elicitation answers cannot contain form content",
        });
      }
    } else if (answer.action === "accept") {
      // Keep schema IDs isolated while using the SDK's runtime-selected validator.
      const validator = fromJsonSchema(
        request.requestedSchema,
        new DefaultJsonSchemaValidator()
      );

      const parsed = await validator["~standard"].validate(
        answer.content ?? {}
      );

      if (parsed.issues) {
        for (const issue of parsed.issues) {
          ctx.issues.push({
            code: "custom",
            message: issue.message,
            input: answer.content,
            path: [
              "content",
              ...(issue.path?.map((segment) =>
                typeof segment === "object" ? segment.key : segment
              ) ?? []),
            ],
          });
        }
      }
    }
  });
}

/** Parse application input using the SDK result contract and the requested form. */
export function validateElicitationAnswer(
  request: MCPElicitationRequest,
  input: unknown
): Promise<MCPElicitationAnswer> {
  return elicitationAnswerFor(request).parseAsync(input);
}

/** Install before connect, so capabilities and handlers agree during negotiation. */
export function configureElicitation(
  client: Client,
  server: string,
  handler?: MCPElicitationHandler
): void {
  if (!handler) return;

  client.setRequestHandler("elicitation/create", async (request, context) => {
    const { signal } = context.mcpReq;
    signal.throwIfAborted();
    const answer = await handler(request.params, { server, signal });
    signal.throwIfAborted();

    return validateElicitationAnswer(request.params, answer);
  });
}
