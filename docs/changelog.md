---
outline: deep
---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-03-17

### Added

- Agent Hub with remote registry and version check notifications
- CLI `xclaw update` command for checking and updating packages
- Gateway API endpoints: `/api/version`, `/api/version/check`, `/api/agent-registry`
- Version checker utility in `@xclaw/core`
- Automated npm publish workflow with GitHub Releases
- VitePress documentation site at xclaw.xdev.asia
- Discord and Telegram channel plugins
- Healthcare skills: clinical alerts, drug interaction checks
- Knowledge packs: ICD-10 drug interactions, VN drug formulary
- Multi-LLM router with OpenAI, Anthropic, Google support
- Workflow engine with drag-and-drop builder
- Memory system with short-term and long-term storage
- Session management and authentication service

### Changed

- Migrated docs domain from ai.xdev.asia to xclaw.xdev.asia

## [0.1.0] - 2025-01-01

### Added

- Initial project setup with monorepo structure
- Core agent framework with event bus
- Basic skill system architecture
- CLI scaffolding with Commander.js
- Web UI with React + Vite + TailwindCSS

[0.2.0]: https://github.com/tdduydev/xClaw/releases/tag/v0.2.0
[0.1.0]: https://github.com/tdduydev/xClaw/releases/tag/v0.1.0
