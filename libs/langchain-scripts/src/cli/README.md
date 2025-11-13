# Integration doc CLI

Generate integration documentation using the CLI.

## Supported integration types

- Chat models
- LLMs
- Text embeddings
- Retrievers
- Document loaders

## Usage

1. Build the CLI:

```bash
pnpm build --filter=@langchain/scripts
```

2. Run the CLI:

```bash
pnpm create:integration:doc --classname <Class Name> --type <Type>
```

The `--classname` field should be passed the full class name of the integration, e.g `ChatOpenAI` or `RecursiveUrlLoader`.

The `--type` field should be passed the type of the integration. It must be one of the following:

- `chat`
- `llm`
- `embeddings`
- `retriever`
- `doc_loader`

After invoking the script, you'll be prompted to fill out more integration-specific information.

Finally, the script will log the path of the newly created integration documentation. You should open this notebook, run all the cells, handle and remove any TODOs, and verify all links work as expected.
