# Deployment

You've built your LangChain app and now you're looking to deploy it to production? You've come to the right place. This guide will walk you through the options you have for deploying your app, and the considerations you should make when doing so.

## Overview

LangChain is a library for building applications that use language models. It is not a web framework, and does not provide any built-in functionality for serving your app over the web. Instead, it provides a set of tools that you can integrate in your API or backend server.

There are a couple of high-level options for deploying your app:

- Deploying to a VM or container
  - Persistent filesystem means you can save and load files from disk
  - Always-running process means you can cache some things in memory
  - You can support long-running requests, such as WebSockets
- Deploying to a serverless environment
  - No persistent filesystem means you can load files from disk, but not save them for later
  - Cold start means you can't cache things in memory and expect them to be cached between requests
  - Function timeouts mean you can't support long-running requests, such as WebSockets

Some other considerations include:

- Do you deploy your backend and frontend together, or separately?
- Do you deploy your backend co-located with your database, or separately?

**Production Support:** As you move your LangChains into production, we'd love to offer more hands-on support.
Fill out [this form](https://airtable.com/appwQzlErAS2qiP0L/shrGtGaVBVAz7NcV2) to share more about what you're building, and our team will get in touch.

## Deployment Options

See below for a list of deployment options for your LangChain app. If you don't see your preferred option, please get in touch and we can add it to this list.

### Deploying to Fly.io

[Fly.io](https://fly.io) is a platform for deploying apps to the cloud. It's a great option for deploying your app to a container environment.

See [our Fly.io template](https://github.com/hwchase17/langchain-template-node-fly) for an example of how to deploy your app to Fly.io.

### Deploying to Kinsta

[Kinsta](https://kinsta.com) is a developer-centric cloud host platform.

Use [our hello-world template](https://github.com/kinsta/hello-world-langchainjs) for an example of how to deploy your next LangChain app at Kinsta in minutes.
