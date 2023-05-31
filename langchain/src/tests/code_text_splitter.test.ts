import { test, expect } from "@jest/globals";
import { CodeTextSplitter } from "../text_splitter.js";

test("Python code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "python",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `def hello_world():
  print("Hello, World!")
# Call the function
hello_world()`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "def",
    "hello_world():",
    'print("Hello,',
    'World!")',
    "# Call the",
    "function",
    "hello_world()",
  ]);
});

test("Golang code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "go",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `package main
import "fmt"
func helloWorld() {
    fmt.Println("Hello, World!")
}
func main() {
    helloWorld()
}`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "package main",
    'import "fmt"',
    "helloWorld() {",
    'fmt.Println("Hel',
    "lo,",
    'World!")',
    "}",
    "main() {",
    "helloWorld()",
    "}",
  ]);
});

test("RST code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "rst",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `Sample Document
===============
Section
-------
This is the content of the section.
Lists
-----
- Item 1
- Item 2
- Item 3`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "Sample Document",
    "===============",
    "Section\n-------",
    "This is the",
    "content of the",
    "section.",
    "Lists\n-----",
    "- Item 1",
    "- Item 2",
    "- Item 3",
  ]);
});

test("Proto code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "proto",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `syntax = "proto3";
package example;
message Person {
    string name = 1;
    int32 age = 2;
    repeated string hobbies = 3;
}`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "syntax =",
    '"proto3";',
    "package example;",
    "Person {",
    "string name = 1;",
    "int32 age = 2;",
    "repeated string",
    "hobbies = 3;",
    "}",
  ]);
});

test("JS code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "js",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `function helloWorld() {
  console.log("Hello, World!");
}
// Call the function
helloWorld();`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "function",
    "helloWorld() {",
    'console.log("Hel',
    "lo,",
    'World!");',
    "}",
    "// Call the",
    "function",
    "helloWorld();",
  ]);
});

test("Java code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "java",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `public class HelloWorld {
  public static void main(String[] args) {
      System.out.println("Hello, World!");
  }
}`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "public class",
    "HelloWorld {",
    "public static",
    "void",
    "main(String[]",
    "args) {",
    "System.out.print",
    'ln("Hello,',
    'World!");',
    "}\n}",
  ]);
});

test("CPP code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "cpp",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "#include",
    "<iostream>",
    "main() {",
    "std::cout <<",
    '"Hello, World!"',
    "<< std::endl;",
    "return 0;\n}",
  ]);
});

test("Scala code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "scala",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `object HelloWorld {
  def main(args: Array[String]): Unit = {
    println("Hello, World!")
  }
}`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "object",
    "HelloWorld {",
    "def main(args:",
    "Array[String]):",
    "Unit = {",
    'println("Hello,',
    'World!")',
    "}\n}",
  ]);
});

test("Ruby code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "ruby",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `def hello_world
  puts "Hello, World!"
end
hello_world`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "def hello_world",
    'puts "Hello,',
    'World!"',
    "end\nhello_world",
  ]);
});

test("PHP code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "php",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `<?php
function hello_world() {
    echo "Hello, World!";
}
hello_world();
?>`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "<?php",
    "hello_world() {",
    'echo "Hello,',
    'World!";',
    "}\nhello_world();",
    "?>",
  ]);
});

test("Swift code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "swift",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `func helloWorld() {
  print("Hello, World!")
}
helloWorld()`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "func",
    "helloWorld() {",
    'print("Hello,',
    'World!")',
    "}\nhelloWorld()",
  ]);
});

test("Rust code splitter", async () => {
  const splitter = new CodeTextSplitter({
    language: "swift",
    chunkSize: 16,
    chunkOverlap: 0,
  });
  const code = `fn main() {
  println!("Hello, World!");
}`;
  const chunks = await splitter.splitText(code);
  expect(chunks).toStrictEqual([
    "fn main() {",
    'println!("Hello,',
    'World!");',
    "}",
  ]);
});
