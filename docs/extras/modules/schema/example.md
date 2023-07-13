---
---

# Examples

Examples are input/output pairs that represent inputs to a function and then expected output. They can be used in both training and evaluation of models.

```typescript
type Example = Record<string, string>;
```

## Creating an Example

You can create an Example like this:

```typescript
const example = {
  input: "foo",
  output: "bar",
};
```
