import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { convertMcpToolToLangchainTool, loadMcpTools } from '../src/tools.js';
import { z } from 'zod';

// Create a mock client
const mockClient = {
  callTool: jest.fn(),
  listTools: jest.fn(),
};

describe('Simplified Tool Adapter Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertMcpToolToLangchainTool', () => {
    test('should convert MCP tool to LangChain tool with text content', async () => {
      // Set up mock tool
      const mcpTool = {
        name: 'testTool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
      };

      // Set up mock response
      mockClient.callTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Test result' }],
      });

      // Convert tool
      const tool = convertMcpToolToLangchainTool(mockClient as unknown as Client, mcpTool);

      // Verify tool properties
      expect(tool.name).toBe('testTool');
      expect(tool.description).toBe('A test tool');

      // Call the tool
      const result = await tool.invoke({ input: 'test' });

      // Verify that the client was called with the right arguments
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'testTool',
        arguments: { input: 'test' },
      });

      // Verify result
      expect(result).toBe('Test result');
    });

    test('should handle error results', async () => {
      // Set up mock tool
      const mcpTool = {
        name: 'errorTool',
        description: 'A tool that errors',
      };

      // Set up mock response
      mockClient.callTool.mockResolvedValueOnce({
        isError: true,
        content: [{ type: 'text', text: 'Error message' }],
      });

      // Convert tool
      const tool = convertMcpToolToLangchainTool(mockClient as unknown as Client, mcpTool);

      // Call the tool and expect an error
      await expect(tool.invoke({ input: 'test' })).rejects.toThrow('Error message');
    });

    test('should handle non-text content', async () => {
      // Set up mock tool
      const mcpTool = {
        name: 'imageTool',
        description: 'A tool that returns images',
      };

      // Set up mock response with non-text content
      mockClient.callTool.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Image caption' },
          { type: 'image', url: 'http://example.com/image.jpg' },
        ],
      });

      // Convert tool
      const tool = convertMcpToolToLangchainTool(mockClient as unknown as Client, mcpTool);

      // Call the tool
      const result = await tool.invoke({ input: 'test' });

      // Verify result (should only include text content)
      expect(result).toBe('Image caption');
    });

    test('should return both text and non-text content with content_and_artifact format', async () => {
      // Set up mock tool
      const mcpTool = {
        name: 'multiTool',
        description: 'A tool that returns multiple content types',
      };

      // Set up mock response with mixed content
      const mockImageContent = { type: 'image', url: 'http://example.com/image.jpg' };
      mockClient.callTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Here is your image' }, mockImageContent],
      });

      // Convert tool with content_and_artifact response format
      const tool = convertMcpToolToLangchainTool(
        mockClient as unknown as Client,
        mcpTool,
        undefined,
        'content_and_artifact'
      );

      // Verify tool properties
      console.log('Tool class:', tool.constructor.name);
      console.log('Tool responseFormat:', (tool as any).responseFormat);

      // Call the tool
      const result = await tool.invoke({ input: 'test' });

      // Debug the result
      console.log('Result type:', typeof result);
      console.log('Result:', JSON.stringify(result));
      console.log('Is array:', Array.isArray(result));

      // The result is the text content, as LangChain processes the array in the call method
      expect(result).toBe('Here is your image');

      // Set up a second mock response for the direct call test
      mockClient.callTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Here is your image' }, mockImageContent],
      });

      // Access the tool class implementation through the prototype chain
      const toolPrototype = Object.getPrototypeOf(tool);
      // Call the _call method directly with bound 'this' context
      const directResult = await toolPrototype._call.call(tool, { input: 'test' });

      expect(Array.isArray(directResult)).toBe(true);

      const [textContent, nonTextContent] = directResult as [string, any[]];

      // Check the text content
      expect(textContent).toBe('Here is your image');

      // Check the non-text content
      expect(Array.isArray(nonTextContent)).toBe(true);
      expect(nonTextContent.length).toBe(1);
      expect(nonTextContent[0]).toEqual(mockImageContent);
    });
  });

  describe('loadMcpTools', () => {
    test('should load all tools from client', async () => {
      // Set up mock response
      mockClient.listTools.mockResolvedValueOnce({
        tools: [
          { name: 'tool1', description: 'Tool 1' },
          { name: 'tool2', description: 'Tool 2' },
        ],
      });

      // Load tools
      const tools = await loadMcpTools(mockClient as unknown as Client);

      // Verify results
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    test('should handle empty tool list', async () => {
      // Set up mock response
      mockClient.listTools.mockResolvedValueOnce({
        tools: [],
      });

      // Load tools
      const tools = await loadMcpTools(mockClient as unknown as Client);

      // Verify results
      expect(tools.length).toBe(0);
    });

    test('should filter out tools without names', async () => {
      // Set up mock response
      mockClient.listTools.mockResolvedValueOnce({
        tools: [
          { name: 'tool1', description: 'Tool 1' },
          { description: 'No name tool' }, // Should be filtered out
          { name: 'tool2', description: 'Tool 2' },
        ],
      });

      // Load tools
      const tools = await loadMcpTools(mockClient as unknown as Client);

      // Verify results
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    test('should load tools with specified response format', async () => {
      // Set up mock response
      mockClient.listTools.mockResolvedValueOnce({
        tools: [{ name: 'tool1', description: 'Tool 1' }],
      });

      // Load tools with content_and_artifact response format
      const tools = await loadMcpTools(mockClient as unknown as Client, 'content_and_artifact');

      // Verify tool was loaded
      expect(tools.length).toBe(1);
      expect((tools[0] as any).responseFormat).toBe('content_and_artifact');

      // Mock the call result to check response format handling
      const mockImageContent = { type: 'image', url: 'http://example.com/image.jpg' };
      mockClient.callTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Image result' }, mockImageContent],
      });

      // Invoke the tool
      const result = await tools[0].invoke({ test: 'input' });

      // The result is the text content, as LangChain processes the array in the call method
      expect(result).toBe('Image result');

      // Set up a second mock response for the direct call test
      mockClient.callTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Image result' }, mockImageContent],
      });

      // Access the tool class implementation through the prototype chain
      const toolPrototype = Object.getPrototypeOf(tools[0]);
      // Call the _call method directly with bound 'this' context
      const directResult = await toolPrototype._call.call(tools[0], { test: 'input' });

      expect(Array.isArray(directResult)).toBe(true);

      const [textContent, nonTextContent] = directResult as [string, any[]];

      expect(textContent).toBe('Image result');
      expect(nonTextContent.length).toBe(1);
      expect(nonTextContent[0]).toEqual(mockImageContent);
    });
  });
});
