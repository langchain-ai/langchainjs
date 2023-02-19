# Text Splitter

Language Models are often limited by the amount of text that you can pass to them. Therefore, it is neccessary to split them up into smaller chunks. LangChain provides several utilities for doing so.

The recommended TextSplitter is the `RecursiveCharacterTextSplitter`. This will split documents recursively by different characters - starting with `"\n\n"`, then `"\n"`, then `" "`. This is nice because it will try to keep all the semantically relevant content in the same place for as long as possible.

Important parameters to know here are `chunkSize` and `chunkOverlap`. `chunkSize` controls the max size (in terms of number of characters) of the final documents. `chunkOverlap` specifies how much overlap there should be between chunks. This is often helpful to make sure that the text isn't split weirdly. In the example below we set these values to be small (for illustration purposes), but in practice they default to `4000` and `200` respectively.

```typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const text = `Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.
This is a weird text to write, but gotta test the splittingggg some how.\n\n
Bye!\n\n-H.`;
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 10,
  chunkOverlap: 1,
});
const output = splitter.createDocuments([text]);
```

You'll note that in the above example we are splitting a raw text string and getting back a list of documents. We can also split documents directly.

```typescript
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const text = `Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.
This is a weird text to write, but gotta test the splittingggg some how.\n\n
Bye!\n\n-H.`;
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 10,
  chunkOverlap: 1,
});
const docOutput = splitter.splitDocuments([
  new Document({ pageContent: text }),
]);
```

Besides the `RecursiveCharacterTextSplitter`, there is also the more standard `CharacterTextSplitter`. This splits only on one type of character (defaults to `"\n\n"`). You can use it in the exact same way.

```typescript
import { Document } from "langchain/document";
import { CharacterTextSplitter } from "langchain/text_splitter";

const text = "foo bar baz 123";
const splitter = new CharacterTextSplitter({
  separator: " ",
  chunkSize: 7,
  chunkOverlap: 3,
});
const output = splitter.createDocuments([text]);
```
