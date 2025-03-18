import { describe, test, expect, beforeEach, vi } from 'vitest';
const { loadMcpTools } = await import('../src/tools.js');

// Create a mock client
const mockClient = {
  callTool: vi.fn(),
  listTools: vi.fn(),
};

describe('Simplified Tool Adapter Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadMcpTools', () => {
    test('should load all tools from client', async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            { name: 'tool1', description: 'Tool 1' },
            { name: 'tool2', description: 'Tool 2' },
          ],
        })
      );

      // Load tools
      const tools = await loadMcpTools(mockClient as unknown as Parameters<typeof loadMcpTools>[0]);

      // Verify results
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    test('should handle empty tool list', async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [],
        })
      );

      // Load tools
      const tools = await loadMcpTools(mockClient as unknown as Parameters<typeof loadMcpTools>[0]);

      // Verify results
      expect(tools.length).toBe(0);
    });

    test('should filter out tools without names', async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            { name: 'tool1', description: 'Tool 1' },
            { description: 'No name tool' }, // Should be filtered out
            { name: 'tool2', description: 'Tool 2' },
          ],
        })
      );

      // Load tools
      const tools = await loadMcpTools(mockClient as unknown as Parameters<typeof loadMcpTools>[0]);

      // Verify results
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    test('should load tools with specified response format', async () => {
      // Set up mock response with input schema
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: 'tool1',
              description: 'Tool 1',
              inputSchema: {
                type: 'object',
                properties: {
                  input: { type: 'string' },
                },
                required: ['input'],
              },
            },
          ],
        })
      );

      // Load tools with content_and_artifact response format
      const tools = await loadMcpTools(
        mockClient as unknown as Parameters<typeof loadMcpTools>[0],
        'content_and_artifact'
      );

      // Verify tool was loaded
      expect(tools.length).toBe(1);
      expect((tools[0] as any).responseFormat).toBe('content');

      // Mock the call result to check response format handling
      const mockImageContent = { type: 'image', url: 'http://example.com/image.jpg' };
      mockClient.callTool.mockReturnValueOnce(
        Promise.resolve({
          content: [{ type: 'text', text: 'Image result' }, mockImageContent],
        })
      );

      // Invoke the tool with proper input matching the schema
      const result = await tools[0].invoke({ input: 'test input' });

      // Verify the result
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toBe('Image result');
      expect(result[1]).toEqual([mockImageContent]);

      // Set up a second mock response for the direct call test
      mockClient.callTool.mockReturnValueOnce(
        Promise.resolve({
          content: [{ type: 'text', text: 'Image result' }, mockImageContent],
        })
      );

      // Access the tool class implementation through the prototype chain
      const toolPrototype = Object.getPrototypeOf(tools[0]);
      // Call the _call method directly with bound 'this' context
      const directResult = await toolPrototype._call.call(tools[0], { input: 'test input' });

      expect(Array.isArray(directResult)).toBe(true);

      const [textContent, nonTextContent] = directResult as [string, any[]];

      expect(textContent).toBe('Image result');
      expect(nonTextContent.length).toBe(1);
      expect(nonTextContent[0]).toEqual(mockImageContent);
    });
  });
});
