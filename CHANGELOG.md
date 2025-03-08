# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7] - 2024-05-08

### Fixed

- Fixed SSE headers support to properly pass headers to eventsource
- Improved error handling for SSE connections
- Added proper support for Node.js eventsource library
- Fixed type errors in agent integration tests

### Added

- Improved test coverage to over 80%
- Added comprehensive error handling tests
- Added integration tests for different connection types

### Changed

- Updated ESLint configuration to properly exclude dist directory
- Improved build process to avoid linting errors

## [0.1.3] - 2023-03-11

### Changed

- Version bump to resolve npm publishing conflict
- Automated version management in GitHub Actions workflow

## [0.1.2] - 2023-03-10

### Added

- GitHub Actions workflows for PR validation, CI, and npm publishing
- Husky for Git hooks
- lint-staged for running linters on staged files
- Issue and PR templates
- CHANGELOG.md and CONTRIBUTING.md
- Improved npm publishing workflow with automatic version conflict resolution

### Fixed

- Fixed Husky deprecation warnings

## [0.1.0] - 2023-03-03

### Added

- Initial release
- Support for stdio and SSE transports
- MultiServerMCPClient for connecting to multiple MCP servers
- Configuration file support
- Examples for various use cases
- Integration with LangChain.js agents
