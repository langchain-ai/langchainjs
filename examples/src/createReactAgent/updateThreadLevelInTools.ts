/**
 * Update Thread Level Context in Tools
 *
 * This allows tools to modify the conversation state and add information that becomes part of the ongoing thread
 * context, enabling stateful tool interactions.
 *
 * Why this is important:
 * - State Persistence:
 *   Tools can record their actions and results for future reference within the conversation
 * - Workflow Coordination:
 *   Enables complex multi-step processes where tools build upon each other's results
 * - Conversation Enrichment:
 *   Tools can contribute structured data and metadata that enhances the dialogue context
 *
 * Example Scenario:
 * You're building a project management assistant. When the "create_task" tool is used, it not only creates the task
 * but also updates the conversation state with the task ID, assignee, and deadline. Later tools and the agent can
 * reference this information without the user having to repeat task details.
 */

import fs from "node:fs/promises";
import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

/**
 * Simulated project state that persists across tool calls
 */
interface ProjectState {
  tasks: Array<{
    id: string;
    title: string;
    assignee: string;
    status: "pending" | "in_progress" | "completed";
    priority: "low" | "medium" | "high";
    deadline?: string;
    dependencies?: string[];
  }>;
  teamMembers: string[];
  currentSprint?: string;
}

/**
 * Global project state (in a real app, this would be in a database)
 */
const projectState: ProjectState = {
  tasks: [],
  teamMembers: ["Alice", "Bob", "Charlie", "Diana"],
  currentSprint: "Sprint 2024-Q1",
};

/**
 * Task creation tool that updates thread-level state
 */
const createTaskTool = tool(
  async (
    input: {
      title: string;
      assignee: string;
      priority: "low" | "medium" | "high";
      deadline?: string;
    },
    config
  ) => {
    /**
     * Access current conversation state
     */
    const currentMessages =
      config?.configurable?.__pregel_scratchpad?.currentTaskInput?.messages ||
      [];

    /**
     * Analyze conversation for context and dependencies
     */
    const recentTasks = currentMessages
      .filter((msg: any) => {
        const content = msg.kwargs?.content || msg.content || "";
        return typeof content === "string" && content.includes("Task created:");
      })
      .slice(-3);

    /**
     * Generate unique task ID and create task
     */
    const taskId = `TASK-${Date.now().toString().slice(-6)}`;
    const newTask = {
      id: taskId,
      title: input.title,
      assignee: input.assignee,
      status: "pending" as const,
      priority: input.priority,
      deadline: input.deadline,
    };

    /**
     * Update global project state
     */
    projectState.tasks.push(newTask);

    /**
     * Analyze recent tasks for context
     */
    let contextNote = "";
    if (recentTasks.length > 0) {
      contextNote = `\n\nRelated to recent tasks in this conversation (${recentTasks.length} previous tasks created).`;
    }

    /**
     * Return structured response that enriches conversation state
     * The returned content becomes part of the conversation thread
     */
    const taskSummary = `Task created: "${input.title}" (${taskId})
- Assignee: ${input.assignee}
- Priority: ${input.priority}
- Status: pending
- Sprint: ${projectState.currentSprint}${
      input.deadline ? `\n- Deadline: ${input.deadline}` : ""
    }

Current sprint now has ${projectState.tasks.length} total tasks.${contextNote}`;

    console.log(`✓ Created task ${taskId}: ${input.title}`);

    return taskSummary;
  },
  {
    name: "create_task",
    description: "Create a new project task and update the project state",
    schema: z.object({
      title: z.string().describe("Title of the task"),
      assignee: z.string().describe("Team member assigned to the task"),
      priority: z
        .enum(["low", "medium", "high"])
        .describe("Priority level of the task"),
      deadline: z
        .string()
        .optional()
        .describe("Optional deadline for the task (YYYY-MM-DD format)"),
    }),
  }
);

/**
 * Task status update tool that leverages conversation history
 */
const updateTaskStatusTool = tool(
  async (
    input: {
      taskId?: string;
      taskTitle?: string;
      newStatus: "pending" | "in_progress" | "completed";
    },
    config
  ) => {
    /**
     * Access conversation history to find task references
     */
    const currentMessages =
      config?.configurable?.__pregel_scratchpad?.currentTaskInput?.messages ||
      [];

    let targetTask = null;

    // If task ID provided, find by ID
    if (input.taskId) {
      targetTask = projectState.tasks.find((task) => task.id === input.taskId);
    }
    // If task title provided, find by title
    else if (input.taskTitle) {
      targetTask = projectState.tasks.find(
        (task) =>
          input.taskTitle &&
          task.title.toLowerCase().includes(input.taskTitle.toLowerCase())
      );
    }
    // Otherwise, try to infer from recent conversation
    else {
      const recentTaskMentions = currentMessages
        .slice(-5)
        .map((msg: any) => {
          const content = msg.kwargs?.content || msg.content || "";
          const taskMatch = content.match(
            /Task created: "([^"]+)" \(([^)]+)\)/
          );
          return taskMatch ? { title: taskMatch[1], id: taskMatch[2] } : null;
        })
        .filter(Boolean);

      if (recentTaskMentions.length > 0) {
        const lastMention = recentTaskMentions[recentTaskMentions.length - 1];
        targetTask = projectState.tasks.find(
          (task) => lastMention && task.id === lastMention.id
        );
      }
    }

    if (!targetTask) {
      return `Could not find task to update. Available tasks:
${projectState.tasks
  .map((task) => `- ${task.title} (${task.id}) - ${task.status}`)
  .join("\n")}`;
    }

    const oldStatus = targetTask.status;
    targetTask.status = input.newStatus;

    /**
     * Return status update that becomes part of conversation state
     */
    const statusUpdate = `Task status updated: "${targetTask.title}" (${
      targetTask.id
    })
- Previous status: ${oldStatus}
- New status: ${input.newStatus}
- Assignee: ${targetTask.assignee}
- Priority: ${targetTask.priority}

Sprint progress: ${
      projectState.tasks.filter((t) => t.status === "completed").length
    }/${projectState.tasks.length} tasks completed.`;

    console.log(
      `✓ Updated task ${targetTask.id} status: ${oldStatus} → ${input.newStatus}`
    );

    return statusUpdate;
  },
  {
    name: "update_task_status",
    description:
      "Update the status of a project task using task ID, title, or context from recent conversation",
    schema: z.object({
      taskId: z
        .string()
        .optional()
        .describe("Specific task ID to update (e.g., TASK-123456)"),
      taskTitle: z
        .string()
        .optional()
        .describe("Part of the task title to search for"),
      newStatus: z
        .enum(["pending", "in_progress", "completed"])
        .describe("New status for the task"),
    }),
  }
);

/**
 * Project overview tool that reads accumulated state
 */
const projectOverviewTool = tool(
  async (input: { includeDetails?: boolean }, config) => {
    /**
     * Access conversation history to understand what's been discussed
     */
    const currentMessages =
      config?.configurable?.__pregel_scratchpad?.currentTaskInput?.messages ||
      [];

    const taskCreationCount = currentMessages.filter((msg: any) => {
      const content = msg.kwargs?.content || msg.content || "";
      return typeof content === "string" && content.includes("Task created:");
    }).length;

    const statusUpdateCount = currentMessages.filter((msg: any) => {
      const content = msg.kwargs?.content || msg.content || "";
      return (
        typeof content === "string" && content.includes("Task status updated:")
      );
    }).length;

    /**
     * Generate comprehensive project overview
     */
    const overview = `Project Overview - ${projectState.currentSprint}

📊 Overall Stats:
- Total tasks: ${projectState.tasks.length}
- Pending: ${projectState.tasks.filter((t) => t.status === "pending").length}
- In Progress: ${
      projectState.tasks.filter((t) => t.status === "in_progress").length
    }
- Completed: ${
      projectState.tasks.filter((t) => t.status === "completed").length
    }

👥 Team: ${projectState.teamMembers.join(", ")}

📈 Session Activity:
- Tasks created this conversation: ${taskCreationCount}
- Status updates this conversation: ${statusUpdateCount}

${
  input.includeDetails && projectState.tasks.length > 0
    ? `
📋 Current Tasks:
${projectState.tasks
  .map(
    (task) => `
• ${task.title} (${task.id})
  Assignee: ${task.assignee} | Priority: ${task.priority} | Status: ${
      task.status
    }${task.deadline ? ` | Deadline: ${task.deadline}` : ""}`
  )
  .join("")}`
    : ""
}`;

    console.log(
      `📊 Generated project overview with ${projectState.tasks.length} tasks`
    );

    return overview;
  },
  {
    name: "project_overview",
    description: "Get a comprehensive overview of the current project state",
    schema: z.object({
      includeDetails: z
        .boolean()
        .optional()
        .describe("Whether to include detailed task information"),
    }),
  }
);

// Create the agent with stateful tools
const agent = createReactAgent({
  llm,
  tools: [createTaskTool, updateTaskStatusTool, projectOverviewTool],
  prompt: `You are a project management assistant that helps teams organize and track their work.

Your tools can:
- create_task: Create new tasks and automatically update project state
- update_task_status: Change task status, using context from recent conversation when possible
- project_overview: Show current project status with conversation-aware insights

Key behaviors:
1. When creating tasks, always specify realistic priorities and assignees from the team
2. When updating status, try to infer which task to update from recent conversation context
3. After significant changes, offer to show an updated project overview
4. Keep track of the conversation flow to make contextual suggestions

The team members are: Alice, Bob, Charlie, Diana
Current sprint: ${projectState.currentSprint}`,
});

/**
 * Demonstrate stateful tool interactions
 */

console.log("=== Starting Project Management Session ===");

console.log("\n🚀 Creating Initial Tasks");
const result1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Let's start our sprint. Create a high-priority task for Alice to implement user authentication, due 2024-02-15.",
    },
  ],
});

console.log(result1.messages[result1.messages.length - 1].content);

console.log("\n📝 Adding Related Task");
const result2 = await agent.invoke({
  messages: [
    ...result1.messages,
    {
      role: "user",
      content:
        "Also create a medium priority task for Bob to design the login UI, due 2024-02-10.",
    },
  ],
});

console.log(result2.messages[result2.messages.length - 1].content);

console.log("\n✅ Updating Status");
const result3 = await agent.invoke({
  messages: [
    ...result2.messages,
    {
      role: "user",
      content: "Alice just started working on the authentication task.",
    },
  ],
});

console.log(result3.messages[result3.messages.length - 1].content);

console.log("\n📊 Checking Progress");
const result4 = await agent.invoke({
  messages: [
    ...result3.messages,
    {
      role: "user",
      content: "Can you show me a detailed project overview?",
    },
  ],
});

console.log(result4.messages[result4.messages.length - 1].content);

console.log("\n🔄 Smart Status Update");
const result5 = await agent.invoke({
  messages: [
    ...result4.messages,
    {
      role: "user",
      content: "Bob finished the login UI design.",
    },
  ],
});

console.log(result5.messages[result5.messages.length - 1].content);

/**
 * Get the current file's path and derive the output PNG path
 */
const currentFilePath = new URL(import.meta.url).pathname;
const outputPath = currentFilePath.replace(/\.ts$/, ".png");
console.log(`\nSaving visualization to: ${outputPath}`);
await fs.writeFile(outputPath, await agent.drawMermaidPng());

/**
 * Expected output demonstrates how tools update thread-level state:
 *
 * === Starting Project Management Session ===
 *
 * 🚀 Creating Initial Tasks
 * ✓ Created task TASK-212190: Implement user authentication
 * The task "Implement user authentication" has been created for Alice with high priority and a deadline of 2024-02-15. Would you like to see an updated project overview?
 *
 * 📝 Adding Related Task
 * ✓ Created task TASK-214607: Design the login UI
 * 📊 Generated project overview with 2 tasks
 * The task "Design the login UI" has been created for Bob with medium priority and a deadline of 2024-02-10.
 *
 * Here's the updated project overview for Sprint 2024-Q1:
 *
 * 📊 **Overall Stats:**
 * - Total tasks: 2
 * - Pending: 2
 * - In Progress: 0
 * - Completed: 0
 *
 * 👥 **Team:** Alice, Bob, Charlie, Diana
 *
 * 📈 **Session Activity:**
 * - Tasks created this conversation: 2
 * - Status updates this conversation: 0
 *
 * 📋 **Current Tasks:**
 *
 * • **Implement user authentication** (TASK-212190)
 *   - Assignee: Alice
 *   - Priority: high
 *   - Status: pending
 *   - Deadline: 2024-02-15
 *
 * • **Design the login UI** (TASK-214607)
 *   - Assignee: Bob
 *   - Priority: medium
 *   - Status: pending
 *   - Deadline: 2024-02-10
 *
 * If there's anything else you'd like to do, just let me know!
 *
 * ✅ Updating Status
 * ✓ Updated task TASK-212190 status: pending → in_progress
 * The task "Implement user authentication" is now marked as "in progress" for Alice. Would you like to see the updated project overview or do anything else?
 *
 * 📊 Checking Progress
 * 📊 Generated project overview with 2 tasks
 * Here's the detailed project overview for Sprint 2024-Q1:
 *
 * 📊 **Overall Stats:**
 * - Total tasks: 2
 * - Pending: 1
 * - In Progress: 1
 * - Completed: 0
 *
 * 👥 **Team:** Alice, Bob, Charlie, Diana
 *
 * 📈 **Session Activity:**
 * - Tasks created this conversation: 2
 * - Status updates this conversation: 1
 *
 * 📋 **Current Tasks:**
 *
 * • **Implement user authentication** (TASK-212190)
 *   - Assignee: Alice
 *   - Priority: high
 *   - Status: in_progress
 *   - Deadline: 2024-02-15
 *
 * • **Design the login UI** (TASK-214607)
 *   - Assignee: Bob
 *   - Priority: medium
 *   - Status: pending
 *   - Deadline: 2024-02-10
 *
 * If there's anything else you'd like to do, feel free to let me know!
 *
 * 🔄 Smart Status Update
 * ✓ Updated task TASK-214607 status: pending → completed
 * The task "Design the login UI" has been marked as "completed" by Bob. Now, 1 out of 2 tasks in the sprint are completed. Would you like to see the updated project overview or do anything else?
 */
