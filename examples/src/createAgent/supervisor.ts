/**
 * Complete Personal Assistant Supervisor Example with Human-in-the-Loop
 *
 * This example demonstrates:
 * 1. The tool calling pattern for multi-agent systems
 * 2. Human-in-the-loop review of sensitive actions
 * 3. Approve/edit/reject decisions for tool calls
 *
 * A supervisor agent coordinates specialized sub-agents (calendar and email)
 * that are wrapped as tools, with human approval for sensitive operations.
 *
 * This example is designed to accompany the supervisor tutorial:
 *
 * https://docs.langchain.com/oss/javascript/langchain/supervisor
 */

import { tool, createAgent, humanInTheLoopMiddleware } from "langchain";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import { MemorySaver, Command } from "@langchain/langgraph";

// ============================================================================
// Step 1: Define low-level API tools (stubbed)
// ============================================================================

const createCalendarEvent = tool(
  async ({ title, startTime, endTime, attendees, location }) => {
    // Stub: In practice, this would call Google Calendar API, Outlook API, etc.
    return `Event created: ${title} from ${startTime} to ${endTime} with ${attendees.length} attendees`;
  },
  {
    name: "create_calendar_event",
    description: "Create a calendar event. Requires exact ISO datetime format.",
    schema: z.object({
      title: z.string(),
      startTime: z.string().describe("ISO format: '2024-01-15T14:00:00'"),
      endTime: z.string().describe("ISO format: '2024-01-15T15:00:00'"),
      attendees: z.array(z.string()).describe("email addresses"),
      location: z.string().optional().default(""),
    }),
  }
);

const sendEmail = tool(
  async ({ to, subject, body, cc }) => {
    // Stub: In practice, this would call SendGrid, Gmail API, etc.
    return `Email sent to ${to.join(", ")} - Subject: ${subject}`;
  },
  {
    name: "send_email",
    description:
      "Send an email via email API. Requires properly formatted addresses.",
    schema: z.object({
      to: z.array(z.string()).describe("email addresses"),
      subject: z.string(),
      body: z.string(),
      cc: z.array(z.string()).optional().default([]),
    }),
  }
);

const getAvailableTimeSlots = tool(
  async ({ attendees, date, durationMinutes }) => {
    // Stub: In practice, this would query calendar APIs
    return ["09:00", "14:00", "16:00"];
  },
  {
    name: "get_available_time_slots",
    description:
      "Check calendar availability for given attendees on a specific date.",
    schema: z.object({
      attendees: z.array(z.string()),
      date: z.string().describe("ISO format: '2024-01-15'"),
      durationMinutes: z.number(),
    }),
  }
);

// ============================================================================
// Step 2: Create specialized sub-agents with human-in-the-loop middleware
// ============================================================================

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

const CALENDAR_AGENT_PROMPT = `
You are a calendar scheduling assistant.
Parse natural language scheduling requests (e.g., 'next Tuesday at 2pm')
into proper ISO datetime formats.
Use get_available_time_slots to check availability when needed.
Use create_calendar_event to schedule events.
Always confirm what was scheduled in your final response.
`.trim();

const EMAIL_AGENT_PROMPT = `
You are an email assistant.
Compose professional emails based on natural language requests.
Extract recipient information and craft appropriate subject lines and body text.
Use send_email to send the message.
Always confirm what was sent in your final response.
`.trim();

const calendarAgent = createAgent({
  model: llm,
  tools: [createCalendarEvent, getAvailableTimeSlots],
  systemPrompt: CALENDAR_AGENT_PROMPT,
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: { create_calendar_event: true },
      descriptionPrefix: "Calendar event pending approval",
    }),
  ],
});

const emailAgent = createAgent({
  model: llm,
  tools: [sendEmail],
  systemPrompt: EMAIL_AGENT_PROMPT,
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: { send_email: true },
      descriptionPrefix: "Outbound email pending approval",
    }),
  ],
});

// ============================================================================
// Step 3: Wrap sub-agents as tools for the supervisor
// ============================================================================

const scheduleEvent = tool(
  async ({ request }) => {
    const result = await calendarAgent.invoke({
      messages: [{ role: "user", content: request }],
    });
    const lastMessage = result.messages[result.messages.length - 1];
    return lastMessage.text;
  },
  {
    name: "schedule_event",
    description: `
Schedule calendar events using natural language.

Use this when the user wants to create, modify, or check calendar appointments.
Handles date/time parsing, availability checking, and event creation.

Input: Natural language scheduling request (e.g., 'meeting with design team next Tuesday at 2pm')
    `.trim(),
    schema: z.object({
      request: z.string().describe("Natural language scheduling request"),
    }),
  }
);

const manageEmail = tool(
  async ({ request }) => {
    const result = await emailAgent.invoke({
      messages: [{ role: "user", content: request }],
    });
    const lastMessage = result.messages[result.messages.length - 1];
    return lastMessage.text;
  },
  {
    name: "manage_email",
    description: `
Send emails using natural language.

Use this when the user wants to send notifications, reminders, or any email communication.
Handles recipient extraction, subject generation, and email composition.

Input: Natural language email request (e.g., 'send them a reminder about the meeting')
    `.trim(),
    schema: z.object({
      request: z.string().describe("Natural language email request"),
    }),
  }
);

// ============================================================================
// Step 4: Create the supervisor agent with checkpointer
// ============================================================================

const SUPERVISOR_PROMPT = `
You are a helpful personal assistant.
You can schedule calendar events and send emails.
Break down user requests into appropriate tool calls and coordinate the results.
When a request involves multiple actions, use multiple tools in sequence.
`.trim();

const supervisorAgent = createAgent({
  model: llm,
  tools: [scheduleEvent, manageEmail],
  systemPrompt: SUPERVISOR_PROMPT,
  checkpointer: new MemorySaver(),
});

// ============================================================================
// Step 5: Demonstrate the complete workflow with human-in-the-loop
// ============================================================================

async function main() {
  const query =
    "Schedule a meeting with the design team next Tuesday at 2pm for 1 hour, " +
    "and send them an email reminder about reviewing the new mockups.";

  const config = { configurable: { thread_id: "6" } };

  console.log("User Request:", query);
  console.log(`\n${"=".repeat(80)}\n`);

  // Initial stream - will interrupt for human approval
  console.log("=== Initial Request (will interrupt for approval) ===\n");

  const interrupts: any[] = [];
  const stream = await supervisorAgent.stream(
    { messages: [{ role: "user", content: query }] },
    config
  );

  for await (const step of stream) {
    for (const update of Object.values(step)) {
      if (update && typeof update === "object" && "messages" in update) {
        for (const message of (update as any).messages) {
          console.log(message.prettyPrint());
        }
      } else if (Array.isArray(update)) {
        const interrupt = update[0];
        interrupts.push(interrupt);
        console.log(`\nINTERRUPTED: ${interrupt.id}`);
      }
    }
  }

  // Inspect the interrupts
  console.log(`\n${"=".repeat(80)}\n`);
  console.log("=== Inspecting Interrupts ===\n");

  for (const interrupt of interrupts) {
    for (const request of interrupt.value.actionRequests) {
      console.log(`INTERRUPTED: ${interrupt.id}`);
      console.log(`${request.description}\n`);
    }
  }

  // Build resume decisions: approve calendar, edit email subject
  console.log(`${"=".repeat(80)}\n`);
  console.log("=== Resuming with Decisions ===");
  console.log("- Approving calendar event");
  console.log("- Editing email subject to 'Mockups reminder'\n");

  const resume: Record<string, any> = {};
  for (const interrupt of interrupts) {
    // Check which interrupt this is by inspecting the tool
    const toolName = interrupt.value.actionRequests[0].name;

    if (toolName === "send_email") {
      // Edit email subject
      const editedAction = { ...interrupt.value.actionRequests[0] };
      editedAction.arguments.subject = "Mockups reminder";
      resume[interrupt.id] = {
        decisions: [{ type: "edit", editedAction }],
      };
    } else {
      // Approve everything else
      resume[interrupt.id] = { decisions: [{ type: "approve" }] };
    }
  }

  const resumeStream = await supervisorAgent.stream(
    new Command({ resume }),
    config
  );

  const moreInterrupts: any[] = [];
  for await (const step of resumeStream) {
    for (const update of Object.values(step)) {
      if (update && typeof update === "object" && "messages" in update) {
        for (const message of (update as any).messages) {
          console.log(message.prettyPrint());
        }
      } else if (Array.isArray(update)) {
        const interrupt = update[0];
        moreInterrupts.push(interrupt);
        console.log(`\nINTERRUPTED: ${interrupt.id}`);
      }
    }
  }

  // Handle any additional interrupts (e.g., for the email)
  if (moreInterrupts.length > 0) {
    console.log(`\n${"=".repeat(80)}\n`);
    console.log("=== Additional Interrupts (Email) ===\n");

    for (const interrupt of moreInterrupts) {
      for (const request of interrupt.value.actionRequests) {
        console.log(`INTERRUPTED: ${interrupt.id}`);
        console.log(`${request.description}\n`);
      }
    }

    console.log(`${"=".repeat(80)}\n`);
    console.log("=== Approving Email ===\n");

    // Approve the email interrupt
    const finalResume: Record<string, any> = {};
    for (const interrupt of moreInterrupts) {
      finalResume[interrupt.id] = { decisions: [{ type: "approve" }] };
    }

    const finalStream = await supervisorAgent.stream(
      new Command({ resume: finalResume }),
      config
    );

    for await (const step of finalStream) {
      for (const update of Object.values(step)) {
        if (update && typeof update === "object" && "messages" in update) {
          for (const message of (update as any).messages) {
            console.log(message.prettyPrint());
          }
        }
      }
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(
    "\n✅ Complete! The supervisor coordinated both agents with human approval."
  );
}

// Run the example
main().catch(console.error);
