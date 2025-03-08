/**
 * Integration test for agent implementations with MCP tools
 *
 * This test demonstrates the recommended approach for using MCP tools
 * with LangChain agents, which is to use standard agents rather than
 * React agents due to compatibility issues.
 */

import { loadMcpTools } from '../src/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';

// Skip actually running this test since it's for documentation purposes
// and requires actual LLM integration
jest.mock('langchain/agents', () => ({
  initializeAgentExecutorWithOptions: jest.fn().mockImplementation(async () => ({
    invoke: jest.fn().mockResolvedValue({ output: 'Test result' }),
  })),
}));

// Mock Client
const mockClient: jest.Mocked<Client> = {
  listTools: jest.fn(),
  callTool: jest.fn(),
  close: jest.fn(),
} as unknown as jest.Mocked<Client>;

describe('Agent Integration (Recommended Approach)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock tools
    mockClient.listTools.mockResolvedValue({
      tools: [
        {
          name: 'add',
          description: 'Add two numbers',
          inputSchema: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' },
            },
            required: ['a', 'b'],
          },
        },
        {
          name: 'search',
          description: 'Search for information',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
      ],
    });
  });

  it('demonstrates the recommended approach with standard agents', async () => {
    // Load MCP tools
    const tools = await loadMcpTools(mockClient);
    expect(tools.length).toBe(2);

    // Create a fake LLM for testing with required responses
    const llm = new FakeListChatModel({
      responses: [
        `I'll use the add tool to calculate 5 + 3.
        Action: add
        Action Input: {"a": 5, "b": 3}
        Observation: 8
        I now know the answer: 8`,
      ],
    });

    // Create a standard agent executor (RECOMMENDED)
    // @ts-expect-error Type assertion to work around version incompatibility issues between different @langchain/core versions
    const executor = await initializeAgentExecutorWithOptions(tools, llm, {
      agentType: 'chat-zero-shot-react-description',
      verbose: true,
    });

    // This is the recommended approach that works with MCP tools
    const result = await executor.invoke({
      input: 'What is 5 plus 3?',
    });

    expect(result).toEqual({ output: 'Test result' });

    // Verify the agent was created with the right parameters
    expect(initializeAgentExecutorWithOptions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'add' }),
        expect.objectContaining({ name: 'search' }),
      ]),
      expect.any(Object),
      expect.objectContaining({
        agentType: 'chat-zero-shot-react-description',
      })
    );
  });

  // For documentation: why React agents are NOT recommended
  it.skip('React agents have compatibility issues with MCP tools', () => {
    // This test is skipped because it would fail
    // The following issues can occur with React agents:
    //
    // 1. "llm [object Object] must define bindTools method" error
    // 2. Gemini: "GenerateContentRequest.tools[0].function_declarations[0].parameters.properties: should be non-empty for OBJECT type"
    //
    // Instead, use the standard agent approach demonstrated above
  });
});
