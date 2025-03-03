# Contributing to LangChain.js MCP Adapters

Thank you for considering contributing to LangChain.js MCP Adapters! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct. Please be respectful and considerate of others.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to see if the problem has already been reported. When you are creating a bug report, please include as many details as possible:

- Use a clear and descriptive title
- Describe the exact steps to reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed and what you expected to see
- Include screenshots if applicable
- Include details about your environment (OS, Node.js version, package version)

### Suggesting Enhancements

Enhancement suggestions are welcome! When suggesting an enhancement:

- Use a clear and descriptive title
- Provide a detailed description of the suggested enhancement
- Explain why this enhancement would be useful to most users
- List some examples of how this enhancement would be used

### Pull Requests

- Fill in the required template
- Follow the TypeScript coding style
- Include tests for new features or bug fixes
- Update documentation as needed
- End all files with a newline
- Make sure your code passes all tests and linting

## Development Workflow

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/langchainjs-mcp-adapters.git`
3. Create a new branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests: `npm test`
6. Run linting: `npm run lint`
7. Commit your changes: `git commit -m "Add some feature"`
8. Push to the branch: `git push origin feature/your-feature-name`
9. Submit a pull request

## Setting Up Development Environment

1. Install dependencies: `npm install`
2. Build the project: `npm run build`
3. Run tests: `npm test`

## Testing

- Write tests for all new features and bug fixes
- Run tests before submitting a pull request: `npm test`
- Ensure code coverage remains high

## Coding Style

- Follow the ESLint and Prettier configurations
- Use meaningful variable and function names
- Write clear comments for complex logic
- Document public APIs using JSDoc comments

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line

## Versioning

This project follows [Semantic Versioning](https://semver.org/). When contributing, consider the impact of your changes:

- PATCH version for backwards-compatible bug fixes
- MINOR version for backwards-compatible new features
- MAJOR version for incompatible API changes

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.
