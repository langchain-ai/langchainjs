interface TextContent {
  type: "text";
  text: {
    content: string;
    link?: { url: string } | null;
  };
}

interface ParagraphBlock {
  object: "block";
  type: "paragraph";
  paragraph: {
    rich_text: TextContent[];
  };
}

interface HeadingBlock {
  object: "block";
  type: "heading_1" | "heading_2" | "heading_3";
  heading_1?: { rich_text: TextContent[] };
  heading_2?: { rich_text: TextContent[] };
  heading_3?: { rich_text: TextContent[] };
}

// Union type for supported blocks (extendable as needed)
export type NotionBlock = ParagraphBlock | HeadingBlock;
