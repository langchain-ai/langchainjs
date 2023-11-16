import { describe, expect, test } from "@jest/globals";
import { Document } from "../document.js";
import {
  CharacterTextSplitter,
  LatexTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
} from "../text_splitter.js";

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
      const res = new CharacterTextSplitter({ chunkSize: 2, chunkOverlap: 4 });
      console.log(res);
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
yarn add langchain
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
    "\\begin{verbatim}\nHopefully this code block isn't split\nyarn add langchain\n\\end{verbatim}",
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
