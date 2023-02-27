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

As you move your LangChains into production, we'd love to offer more comprehensive support. Please fill out [this form](https://forms.gle/57d8AmXBYp8PP8tZA) and we'll set up a dedicated support Slack channel.

## Deployment Options

See below for a list of deployment options for your LangChain app. If you don't see your preferred option, please get in touch and we can add it to this list.

### Deploying to Fly.io

[Fly.io](https://fly.io) is a platform for deploying apps to the cloud. It's a great option for deploying your app to a container environment.

See [our Fly.io template](https://github.com/hwchase17/langchain-template-node-fly) for an example of how to deploy your app to Fly.io.
