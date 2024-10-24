import { test } from "@jest/globals";
import {
  GetNotionPageTool,
  CreateNotionPageTool,
  DeleteNotionPageTool,
  GetBlockContentTool,
} from "../notion/tools.js";

const mockParentPageId = "2655cfc1-a730-48cd-b7e4-dd4545d1d52d";
let mockPageId = "";
const mockPageContent = [
  {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "This is a simple paragraph for testing.",
          },
        },
      ],
    },
  },
  {
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: [
        {
          type: "text",
          text: {
            content: "This is a heading 1 block.",
          },
        },
      ],
    },
  },
];

test("CreateNotionPageTool", async () => {
  const tool = new CreateNotionPageTool();
  const result = await tool.invoke({
    parentPageId: mockParentPageId,
    title: "New Page Title",
    content: mockPageContent,
  });

  expect(result).toBeTruthy();
  expect(result).toHaveProperty("object", "page");
  expect(result).toHaveProperty("id");
  expect(result).toHaveProperty("parent.page_id", mockParentPageId);

  mockPageId = result.id;
});

test("GetNotionPageTool", async () => {
  const tool = new GetNotionPageTool();
  const result = await tool.invoke({ pageId: mockPageId });

  expect(result).toBeTruthy();
  expect(result).toHaveProperty("id");
  expect(result.id).toBe(mockPageId);
  expect(result).toHaveProperty("properties.title.title");
  expect(result.properties.title.title[0]).toHaveProperty(
    "text.content",
    "New Page Title"
  );
});

test("GetBlockContentTool", async () => {
  const tool = new GetBlockContentTool();
  const result = await tool.invoke({
    blockId: mockPageId,
  });
  expect(result).toBeTruthy();
});

test("DeleteNotionPageTool", async () => {
  const tool = new DeleteNotionPageTool();
  const result = await tool.invoke({
    pageId: mockPageId,
  });
  expect(result).toBeTruthy();
});
