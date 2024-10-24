import { NotionBlock } from "./types/interfaces.js";

// Function to create a payload with a dynamic set of blocks
export const createChildPagePayload = (
  parentPageId: string,
  title: string,
  blocks?: NotionBlock[]
) => {
  return {
    parent: { page_id: parentPageId },
    properties: {
      title: [
        {
          type: "text",
          text: {
            content: title,
          },
        },
      ],
    },
    children: blocks || [],
  };
};
