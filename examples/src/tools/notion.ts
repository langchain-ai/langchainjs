import {
  GetNotionPageTool,
  DeleteNotionPageTool,
  CreateNotionPageTool,
  GetBlockContentTool,
} from "@langchain/community/tools/notion";

// Retrieve page data
const getNotionTool = new GetNotionPageTool();
let result = await getNotionTool.invoke({ pageId: "page-id" });

console.log(result);

// Retrieve block data (contents)
const getBlockTool = new GetBlockContentTool();
result = await getBlockTool.invoke({ blockId: "page-id" });

console.log(result);

// Create notion page with title
const createNotionTool = new CreateNotionPageTool();
const content = [
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
result = await createNotionTool.invoke({
  parentPageId: "parent-page-od",
  title: "New Page Title",
  content: content,
});

console.log(result);

// Delete notion page
const tool = new DeleteNotionPageTool();
result = await tool.invoke({ pageId: "page-id" });

console.log(result);
