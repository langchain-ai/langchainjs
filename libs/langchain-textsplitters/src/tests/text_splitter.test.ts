import { describe, expect, test } from "vitest";
import { Document } from "@langchain/core/documents";
import {
  CharacterTextSplitter,
  LatexTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
} from "../index.js";

function textLineGenerator(char: string, length: number) {
  const line = new Array(length).join(char);
  return `${line}\n`;
}

describe("Character text splitter", () => {
  test("Test splitting by character count.", async () => {
    const text = "foo bar baz 123";
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 7,
      chunkOverlap: 3,
    });
    const output = await splitter.splitText(text);
    const expectedOutput = ["foo bar", "bar baz", "baz 123"];
    expect(output).toEqual(expectedOutput);
  });

  test("Test splitting by character count doesn't create empty documents.", async () => {
    const text = "foo  bar";
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 2,
      chunkOverlap: 0,
    });
    const output = await splitter.splitText(text);
    const expectedOutput = ["foo", "bar"];
    expect(output).toEqual(expectedOutput);
  });

  test("Test splitting by character count on long words.", async () => {
    const text = "foo bar baz a a";
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 3,
      chunkOverlap: 1,
    });
    const output = await splitter.splitText(text);
    const expectedOutput = ["foo", "bar", "baz", "a a"];
    expect(output).toEqual(expectedOutput);
  });

  test("Test splitting by character count when shorter words are first.", async () => {
    const text = "a a foo bar baz";
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 3,
      chunkOverlap: 1,
    });
    const output = await splitter.splitText(text);
    const expectedOutput = ["a a", "foo", "bar", "baz"];
    expect(output).toEqual(expectedOutput);
  });

  test("Test splitting by characters when splits not found easily.", async () => {
    const text = "foo bar baz 123";
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 1,
      chunkOverlap: 0,
    });
    const output = await splitter.splitText(text);
    const expectedOutput = ["foo", "bar", "baz", "123"];
    expect(output).toEqual(expectedOutput);
  });

  test("Test invalid arguments.", () => {
    expect(() => {
      // @oxlint-disable-next-line/@typescript-eslint/ban-ts-comment
      // @ts-expect-error unused var
      const res = new CharacterTextSplitter({ chunkSize: 2, chunkOverlap: 4 });
      // console.log(res);
    }).toThrow();
  });

  test("Test create documents method.", async () => {
    const texts = ["foo bar", "baz"];
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 3,
      chunkOverlap: 0,
    });
    const docs = await splitter.createDocuments(texts);
    const metadata = { loc: { lines: { from: 1, to: 1 } } };
    const expectedDocs = [
      new Document({ pageContent: "foo", metadata }),
      new Document({ pageContent: "bar", metadata }),
      new Document({ pageContent: "baz", metadata }),
    ];
    expect(docs).toEqual(expectedDocs);
  });

  test("Test create documents with metadata method.", async () => {
    const texts = ["foo bar", "baz"];
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 3,
      chunkOverlap: 0,
    });
    const docs = await splitter.createDocuments(texts, [
      { source: "1" },
      { source: "2" },
    ]);
    const loc = { lines: { from: 1, to: 1 } };
    const expectedDocs = [
      new Document({ pageContent: "foo", metadata: { source: "1", loc } }),
      new Document({
        pageContent: "bar",
        metadata: { source: "1", loc },
      }),
      new Document({ pageContent: "baz", metadata: { source: "2", loc } }),
    ];
    expect(docs).toEqual(expectedDocs);
  });

  test("Test create documents method with metadata and an added chunk header.", async () => {
    const texts = ["foo bar", "baz"];
    const splitter = new CharacterTextSplitter({
      separator: " ",
      chunkSize: 3,
      chunkOverlap: 0,
    });
    const docs = await splitter.createDocuments(
      texts,
      [{ source: "1" }, { source: "2" }],
      {
        chunkHeader: `SOURCE NAME: testing\n-----\n`,
        appendChunkOverlapHeader: true,
      }
    );
    const loc = { lines: { from: 1, to: 1 } };
    const expectedDocs = [
      new Document({
        pageContent: "SOURCE NAME: testing\n-----\nfoo",
        metadata: { source: "1", loc },
      }),
      new Document({
        pageContent: "SOURCE NAME: testing\n-----\n(cont'd) bar",
        metadata: { source: "1", loc },
      }),
      new Document({
        pageContent: "SOURCE NAME: testing\n-----\nbaz",
        metadata: { source: "2", loc },
      }),
    ];
    expect(docs).toEqual(expectedDocs);
  });
});

describe("Non-overlapping document line locations", () => {
  test.each([
    {
      name: "repeated multiline chunks",
      text: "x\nx\nx\nx",
      options: { chunkSize: 3 },
      contents: ["x\nx", "x\nx"],
      lines: [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
    },
    {
      name: "repeated words",
      text: "same\nsame\nsame\nsame",
      options: { chunkSize: 9 },
      contents: ["same\nsame", "same\nsame"],
      lines: [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
    },
    {
      name: "Unicode character offsets",
      text: "😀\n😀\n😀\n😀",
      options: { chunkSize: 5 },
      contents: ["😀\n😀", "😀\n😀"],
      lines: [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
    },
    {
      name: "CRLF separators",
      text: "same\r\nsame\r\nsame\r\nsame",
      options: { chunkSize: 10, separator: "\r\n" },
      contents: ["same\r\nsame", "same\r\nsame"],
      lines: [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
    },
    {
      name: "kept separators",
      text: "same\nsame\nsame\nsame",
      options: { chunkSize: 9, keepSeparator: true },
      contents: ["same\nsame", "same", "same"],
      lines: [
        { from: 1, to: 2 },
        { from: 3, to: 3 },
        { from: 4, to: 4 },
      ],
    },
    {
      name: "trimmed blank lines",
      text: "\n\nsame\nsame\n\nsame\nsame\n\n",
      options: { chunkSize: 9 },
      contents: ["same\nsame", "same\nsame"],
      lines: [
        { from: 3, to: 4 },
        { from: 6, to: 7 },
      ],
    },
    {
      name: "distinct chunks",
      text: "a\nb\nc\nd",
      options: { chunkSize: 3 },
      contents: ["a\nb", "c\nd"],
      lines: [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
      ],
    },
    {
      name: "repeated single-line chunks",
      text: "xxx\nxxx",
      options: { chunkSize: 3 },
      contents: ["xxx", "xxx"],
      lines: [
        { from: 1, to: 1 },
        { from: 2, to: 2 },
      ],
    },
  ])("$name", async ({ text, options, contents, lines }) => {
    const splitter = new CharacterTextSplitter({
      separator: "\n",
      chunkOverlap: 0,
      ...options,
    });
    const docs = await splitter.createDocuments([text]);
    expect(docs.map((doc) => doc.pageContent)).toEqual(contents);
    expect(docs.map((doc) => doc.metadata.loc.lines)).toEqual(lines);
  });

  test("recursive character chunks use their source occurrence", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      separators: ["\n"],
      chunkSize: 9,
      chunkOverlap: 0,
    });
    const docs = await splitter.createDocuments(["same\nsame\nsame\nsame"]);
    expect(docs.map((doc) => doc.pageContent)).toEqual([
      "same\nsame",
      "same",
      "same",
    ]);
    expect(docs.map((doc) => doc.metadata.loc.lines)).toEqual([
      { from: 1, to: 2 },
      { from: 3, to: 3 },
      { from: 4, to: 4 },
    ]);
  });

  test("keeps intentional overlap", async () => {
    const splitter = new CharacterTextSplitter({
      separator: "\n",
      chunkSize: 3,
      chunkOverlap: 1,
    });
    const docs = await splitter.createDocuments(["x\nx\nx\nx"]);
    expect(docs.map((doc) => doc.pageContent)).toEqual([
      "x\nx",
      "x\nx",
      "x\nx",
    ]);
    expect(docs.map((doc) => doc.metadata.loc.lines)).toEqual([
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ]);
  });

  test("resets locations per document and preserves headers and metadata", async () => {
    const splitter = new CharacterTextSplitter({
      separator: "\n",
      chunkSize: 3,
      chunkOverlap: 0,
    });
    const metadata = { source: "first", loc: { pageNumber: 7 } };
    const docs = await splitter.createDocuments(
      ["x\nx\nx\nx", "x\nx"],
      [metadata, { source: "second" }],
      { chunkHeader: "Source\n", appendChunkOverlapHeader: true }
    );
    expect(docs.map((doc) => doc.pageContent)).toEqual([
      "Source\nx\nx",
      "Source\n(cont'd) x\nx",
      "Source\nx\nx",
    ]);
    expect(docs.map((doc) => doc.metadata)).toEqual([
      { source: "first", loc: { pageNumber: 7, lines: { from: 1, to: 2 } } },
      { source: "first", loc: { pageNumber: 7, lines: { from: 3, to: 4 } } },
      { source: "second", loc: { lines: { from: 1, to: 2 } } },
    ]);
    expect(metadata).toEqual({ source: "first", loc: { pageNumber: 7 } });
  });

  test.each(["constructor", "reassigned", "async"])(
    "preserves custom zero-cost overlap (%s)",
    async (mode) => {
      const lengthFunction = (text: string) => (text === "x" ? 0 : text.length);
      const splitter = new CharacterTextSplitter({
        separator: "\n",
        chunkSize: 3,
        chunkOverlap: 0,
        ...(mode === "constructor" ? { lengthFunction } : {}),
      });
      if (mode === "reassigned") splitter.lengthFunction = lengthFunction;
      if (mode === "async") {
        splitter.lengthFunction = async (text) => lengthFunction(text);
      }
      const docs = await splitter.createDocuments(["a\nx\nb\nx\nb\nx\nc"]);
      expect(docs.map((doc) => doc.pageContent)).toEqual([
        "a\nx",
        "x\nb\nx",
        "x\nb\nx",
        "x\nc",
      ]);
      expect(docs.map((doc) => doc.metadata.loc.lines)).toEqual([
        { from: 1, to: 2 },
        { from: 2, to: 4 },
        { from: 4, to: 6 },
        { from: 6, to: 7 },
      ]);
    }
  );
});

describe("RecursiveCharacter text splitter", () => {
  test("One unique chunk", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 0,
    });
    const content = textLineGenerator("A", 70);

    const docs = await splitter.createDocuments([content]);

    const expectedDocs = [
      new Document({
        pageContent: content.trim(),
        metadata: { loc: { lines: { from: 1, to: 1 } } },
      }),
    ];

    expect(docs).toEqual(expectedDocs);
  });

  test("Test iterative text splitter.", async () => {
    const text = `Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.
This is a weird text to write, but gotta test the splittingggg some how.\n\n
Bye!\n\n-H.`;
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10,
      chunkOverlap: 1,
    });
    const output = await splitter.splitText(text);
    const expectedOutput = [
      "Hi.",
      "I'm",
      "Harrison.",
      "How? Are?",
      "You?",
      "Okay then",
      "f f f f.",
      "This is a",
      "weird",
      "text to",
      "write,",
      "but gotta",
      "test the",
      "splitting",
      "gggg",
      "some how.",
      "Bye!",
      "-H.",
    ];
    expect(output).toEqual(expectedOutput);
  });

  test("A basic chunked document", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 0,
    });
    const line1 = textLineGenerator("A", 70);
    const line2 = textLineGenerator("B", 70);
    const content = line1 + line2;

    const docs = await splitter.createDocuments([content]);

    const expectedDocs = [
      new Document({
        pageContent: line1.trim(),
        metadata: { loc: { lines: { from: 1, to: 1 } } },
      }),
      new Document({
        pageContent: line2.trim(),
        metadata: { loc: { lines: { from: 2, to: 2 } } },
      }),
    ];

    expect(docs).toEqual(expectedDocs);
  });

  test("A chunked document with similar text", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 0,
    });
    const line = textLineGenerator("A", 70);
    const content = line + line;

    const docs = await splitter.createDocuments([content]);

    const expectedDocs = [
      new Document({
        pageContent: line.trim(),
        metadata: { loc: { lines: { from: 1, to: 1 } } },
      }),
      new Document({
        pageContent: line.trim(),
        metadata: { loc: { lines: { from: 2, to: 2 } } },
      }),
    ];

    expect(docs).toEqual(expectedDocs);
  });

  test("A chunked document starting with new lines", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 0,
    });
    const line1 = textLineGenerator("\n", 2);
    const line2 = textLineGenerator("A", 70);
    const line3 = textLineGenerator("\n", 4);
    const line4 = textLineGenerator("B", 70);
    const line5 = textLineGenerator("\n", 4);
    const content = line1 + line2 + line3 + line4 + line5;

    const docs = await splitter.createDocuments([content]);

    const expectedDocs = [
      new Document({
        pageContent: line2.trim(),
        metadata: { loc: { lines: { from: 3, to: 3 } } },
      }),
      new Document({
        pageContent: line4.trim(),
        metadata: { loc: { lines: { from: 8, to: 8 } } },
      }),
    ];

    expect(docs).toEqual(expectedDocs);
  });

  test("A chunked with overlap", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 30,
    });
    const line1 = textLineGenerator("A", 70);
    const line2 = textLineGenerator("B", 20);
    const line3 = textLineGenerator("C", 70);
    const content = line1 + line2 + line3;

    const docs = await splitter.createDocuments([content]);

    const expectedDocs = [
      new Document({
        pageContent: line1 + line2.trim(),
        metadata: { loc: { lines: { from: 1, to: 2 } } },
      }),
      new Document({
        pageContent: line2 + line3.trim(),
        metadata: { loc: { lines: { from: 2, to: 3 } } },
      }),
    ];

    expect(docs).toEqual(expectedDocs);
  });

  test("Chunks with overlap that contains new lines", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 30,
    });
    const line1 = textLineGenerator("A", 70);
    const line2 = textLineGenerator("B", 10);
    const line3 = textLineGenerator("C", 10);
    const line4 = textLineGenerator("D", 70);
    const content = line1 + line2 + line3 + line4;

    const docs = await splitter.createDocuments([content]);

    const expectedDocs = [
      new Document({
        pageContent: line1 + line2 + line3.trim(),
        metadata: { loc: { lines: { from: 1, to: 3 } } },
      }),
      new Document({
        pageContent: line2 + line3 + line4.trim(),
        metadata: { loc: { lines: { from: 2, to: 4 } } },
      }),
    ];
    expect(docs).toEqual(expectedDocs);
  });

  test("Line numbers with a custom lengthFunction", async () => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 3,
      chunkOverlap: 0,
      lengthFunction: (text: string) => text.split(/\s+/).length,
    });

    const docs = await splitter.createDocuments(["aaaa\nbbbb\n\ncccc"]);

    const expectedDocs = [
      new Document({
        pageContent: "aaaa\nbbbb",
        metadata: { loc: { lines: { from: 1, to: 2 } } },
      }),
      new Document({
        pageContent: "cccc",
        metadata: { loc: { lines: { from: 4, to: 4 } } },
      }),
    ];
    expect(docs).toEqual(expectedDocs);
  });
});

test("Separator length is considered correctly for chunk size", async () => {
  const text = "aa ab ac ba bb";
  const splitter = new RecursiveCharacterTextSplitter({
    keepSeparator: false,
    chunkSize: 7,
    chunkOverlap: 3,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["aa ab", "ab ac", "ac ba", "ba bb"];

  expect(output).toEqual(expectedOutput);
});

test("Token text splitter", async () => {
  const text = "foo bar baz a a";
  const splitter = new TokenTextSplitter({
    encodingName: "r50k_base",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo bar b", "az a a"];

  expect(output).toEqual(expectedOutput);
});

test("Token text splitter overlap when last chunk is large", async () => {
  const text = "foo bar baz a a";
  const splitter = new TokenTextSplitter({
    encodingName: "r50k_base",
    chunkSize: 5,
    chunkOverlap: 3,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo bar baz a", " baz a a"];

  expect(output).toEqual(expectedOutput);
});

test("Test markdown text splitter", async () => {
  const text =
    "# 🦜️🔗 LangChain\n" +
    "\n" +
    "⚡ Building applications with LLMs through composability ⚡\n" +
    "\n" +
    "## Quick Install\n" +
    "\n" +
    "```bash\n" +
    "# Hopefully this code block isn't split\n" +
    "pip install langchain\n" +
    "```\n" +
    "\n" +
    "As an open source project in a rapidly developing field, we are extremely open to contributions.";
  const splitter = new MarkdownTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);

  const expectedOutput = [
    "# 🦜️🔗 LangChain\n\n⚡ Building applications with LLMs through composability ⚡",
    "## Quick Install\n\n```bash\n# Hopefully this code block isn't split\npip install langchain",
    "```",
    "As an open source project in a rapidly developing field, we are extremely open to contributions.",
  ];
  expect(output).toEqual(expectedOutput);
});

test("Test latex text splitter.", async () => {
  const text = `\\begin{document}
\\title{🦜️🔗 LangChain}
⚡ Building applications with LLMs through composability ⚡

\\section{Quick Install}

\\begin{verbatim}
Hopefully this code block isn't split
pnpm install langchain
\\end{verbatim}

As an open source project in a rapidly developing field, we are extremely open to contributions.

\\end{document}`;
  const splitter = new LatexTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);

  const expectedOutput = [
    "\\begin{document}\n\\title{🦜️🔗 LangChain}\n⚡ Building applications with LLMs through composability ⚡",
    "\\section{Quick Install}",
    "\\begin{verbatim}\nHopefully this code block isn't split\npnpm install langchain\n\\end{verbatim}",
    "As an open source project in a rapidly developing field, we are extremely open to contributions.",
    "\\end{document}",
  ];
  expect(output).toEqual(expectedOutput);
});

test("Test HTML text splitter", async () => {
  const text = `<!DOCTYPE html>
<html>
  <head>
    <title>🦜️🔗 LangChain</title>
    <style>
      body {
        font-family: Arial, sans-serif;
      }
      h1 {
        color: darkblue;
      }
    </style>
  </head>
  <body>
    <div>
      <h1>🦜️🔗 LangChain</h1>
      <p>⚡ Building applications with LLMs through composability ⚡</p>
    </div>
    <div>
      As an open source project in a rapidly developing field, we are extremely open to contributions.
    </div>
  </body>
</html>`;
  const splitter = RecursiveCharacterTextSplitter.fromLanguage("html", {
    chunkSize: 175,
    chunkOverlap: 20,
  });
  const output = await splitter.splitText(text);

  const expectedOutput = [
    "<!DOCTYPE html>\n<html>",
    "<head>\n    <title>🦜️🔗 LangChain</title>",
    `<style>\n      body {
        font-family: Arial, sans-serif;
      }
      h1 {
        color: darkblue;
      }
    </style>
  </head>`,
    `<body>
    <div>
      <h1>🦜️🔗 LangChain</h1>
      <p>⚡ Building applications with LLMs through composability ⚡</p>
    </div>`,
    `<div>
      As an open source project in a rapidly developing field, we are extremely open to contributions.
    </div>
  </body>
</html>`,
  ];
  expect(output).toEqual(expectedOutput);
});

test("Test lines loc on iterative text splitter.", async () => {
  const text = `Hi.\nI'm Harrison.\n\nHow?\na\nb`;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 20,
    chunkOverlap: 1,
  });
  const docs = await splitter.createDocuments([text]);

  const expectedDocs = [
    new Document({
      pageContent: "Hi.\nI'm Harrison.",
      metadata: { loc: { lines: { from: 1, to: 2 } } },
    }),
    new Document({
      pageContent: "How?\na\nb",
      metadata: { loc: { lines: { from: 4, to: 6 } } },
    }),
  ];

  expect(docs).toEqual(expectedDocs);
});
