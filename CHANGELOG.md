# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
