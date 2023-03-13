# JSON files

You can use two different JSON loader. One using the [JSON pointer](https://github.com/janl/node-jsonpointer) and the other by specifying keys you want to target in your JSON objects.
In both case, one document will be created for each string in the array.

## Using the JSON loader with keys

### Simple example

The most simple way of using it, is to specify no keys. The loader will load all strings in the JSON object.

Example JSON file:

```json
{
  "texts": ["This is a sentence.", "This is another sentence."]
}
```

Example code:

```typescript
import { JSONLoader } from "langchain/document_loaders";

const loader = new JSONLoader("src/document_loaders/example_data/example.json");
const docs = await loader.load();
console.log({ docs });
```

### Advanced example

You can do a more advanced scenario by choosing which keys in your JSON object you want to extract string from.

In this example, we want to only extract information from "from" and "surname" entries.

```json
{
  "1": {
    "body": "BD 2023 SUMMER",
    "from": "LinkedIn Job",
    "labels": ["IMPORTANT", "CATEGORY_UPDATES", "INBOX"]
  },
  "2": {
    "body": "Intern, Treasury and other roles are available",
    "from": "LinkedIn Job2",
    "labels": ["IMPORTANT"],
    "other": {
      "name": "plop",
      "surname": "bob"
    }
  }
}
```

Example code:

```typescript
import { JSONLoader } from "langchain/document_loaders";

const loader = new JSONLoader(
  "src/document_loaders/example_data/example.json",
  ["from", "surname"]
);
const docs = await loader.load();
console.log({ docs });
```

## Using the JSON pointer loader

You can omit the second argument to load a JSON file containing an array of strings.
This example goes over how to load data from JSON files. The second argument is a JSONPointer to the array of strings to extract from the JSON file.

Example JSON file:

```json
{
  "1": {
    "body": "BD 2023 SUMMER",
    "from": "LinkedIn Job",
    "labels": ["IMPORTANT", "CATEGORY_UPDATES", "INBOX"]
  },
  "2": {
    "body": "Intern, Treasury and other roles are available",
    "from": "LinkedIn Job2",
    "labels": ["IMPORTANT"],
    "other": {
      "name": "plop",
      "surname": "bob"
    }
  }
}
```

Example code:

```typescript
import { JSONLoader } from "langchain/document_loaders";

const loader = new JSONPointerLoader(
  "src/document_loaders/example_data/example.json",
  "/2/from"
);
const docs = await loader.load();
console.log({ docs });
```
