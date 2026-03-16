# AutoX - AI Agent Platform

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
</p>

> 🤖 Open-source AI Agent platform with a drag-and-drop Workflow Builder. Multi-industry support: Programming, Healthcare, and more.

## ✨ Features

- **🧠 Multi-LLM Support** — OpenAI, Anthropic Claude, Ollama (local)
- **🔧 Plugin/Skill System** — Modular architecture, easily extensible per industry
- **🎨 Drag & Drop Workflow Builder** — React Flow canvas with 16 node types
- **💬 AI Chat Interface** — Smart chat with iterative tool-calling loop
- **🏥 Healthcare Module** — Symptom analysis, medication management, appointments
- **💻 Programming Module** — Shell, Git, file management, test runner
- **🔌 Event-Driven Architecture** — Pub/sub decoupled communication
- **📡 Real-time WebSocket** — Live workflow execution status updates
- **🐳 Docker Ready** — One-command deployment with Docker Compose

## 📖 Documentation

Detailed system design and architecture documents are available in the [`docs/`](docs/) directory:

| Document | Description |
|---|---|
| [System Architecture](docs/architecture.md) | High-level architecture, component diagram, data flow |
| [API Reference](docs/api-reference.md) | REST API & WebSocket endpoints |
| [Skill Development Guide](docs/skill-development.md) | How to create custom skill packs |
| [Workflow Engine Design](docs/workflow-engine.md) | Workflow execution model, node types, BFS algorithm |

## 🏗️ Project Structure

```
autox/
├── packages/
│   ├── shared/          # Type definitions & constants
│   ├── core/            # Agent engine, LLM router, memory, workflow
│   │   ├── agent/       # Agent core + EventBus
│   │   ├── llm/         # Multi-provider LLM adapter
│   │   ├── memory/      # Vector memory with cosine similarity
│   │   ├── tools/       # Tool registry with approval system
│   │   ├── skills/      # Skill manager (plugin loader)
│   │   └── workflow/    # Workflow engine (BFS execution)
│   ├── skills/          # Skill packs
│   │   ├── programming/ # 11 tools: shell, git, files, tests...
│   │   └── healthcare/  # 11 tools: symptoms, medications, metrics...
│   ├── server/          # Express + WebSocket API
│   └── web/             # React + Vite + React Flow + Tailwind
│       ├── components/
│       │   ├── workflow/ # Canvas, NodePalette, Properties panel
│       │   ├── chat/    # Chat interface
│       │   ├── dashboard/ # Health monitoring
│       │   ├── skills/  # Skill management
│       │   └── settings/ # Agent configuration
│       └── stores/      # Zustand state management
├── docs/                # System design documentation
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10

### Installation

```bash
# Clone the repo
git clone https://github.com/tdduydev/AutoX.git
cd AutoX

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your API keys
```

### Development

```bash
# Run both server + frontend
npm run dev

# Or run individually
npm run dev:server   # Backend API: http://localhost:3001
npm run dev:web      # Frontend UI: http://localhost:3000
```

### Docker

```bash
docker compose up -d
```

## 🔧 LLM Configuration

Supports 3 providers:

| Provider | Models | Notes |
|---|---|---|
| **OpenAI** | gpt-4o-mini, gpt-4o | Requires `OPENAI_API_KEY` |
| **Anthropic** | claude-3-haiku, claude-3-sonnet | Requires `ANTHROPIC_API_KEY` |
| **Ollama** | llama3, mistral, phi3 | Local, free |

## 📦 Skill Packs

### Programming (11 tools)
`shell_exec` · `file_read` · `file_write` · `file_list` · `git_status` · `git_diff` · `git_commit` · `git_log` · `run_tests` · `code_search` · `project_analyze`

### Healthcare (11 tools)
`symptom_analyze` · `medication_check_interaction` · `medication_schedule` · `health_metrics_log` · `health_metrics_query` · `appointment_manage` · `medical_record` · `health_report` · `clinical_note` · `icd_lookup`

### Creating a New Skill Pack

```typescript
import { defineSkill } from '@autox/core';

export const mySkill = defineSkill({
  id: 'my-skill',
  name: 'My Custom Skill',
  version: '1.0.0',
  category: 'custom',
  tools: [
    {
      name: 'my_tool',
      description: 'Does something useful',
      parameters: { /* JSON Schema */ },
      execute: async (args) => {
        return { result: 'done' };
      },
    },
  ],
});
```

See the [Skill Development Guide](docs/skill-development.md) for full documentation.

## 🎨 Workflow Builder

Drag-and-drop visual builder with 16 node types:

| Category | Nodes |
|---|---|
| **Trigger** | Manual, Cron, Webhook, Message, Event |
| **AI** | LLM Call |
| **Action** | Tool Call, HTTP Request, Run Code, Notification |
| **Control** | If/Else, Loop, Switch, Wait, Merge |
| **Data** | Transform, Memory Read/Write, Sub-Workflow |
| **Output** | Output |

See the [Workflow Engine Design](docs/workflow-engine.md) for execution details.

## 🗺️ Roadmap

- [ ] Database persistence (PostgreSQL/MongoDB)
- [ ] Authentication & multi-user
- [ ] Skill marketplace
- [ ] Marketing & Sales skill packs
- [ ] Finance & Legal skill packs
- [ ] Smart Home integration
- [ ] Mobile app (React Native)
- [ ] Webhook triggers & Cron scheduler
- [ ] Workflow versioning & rollback
- [ ] AI model fine-tuning interface

## 🤝 Contributing

Contributions are welcome! Please open an Issue or Pull Request.

## 📄 License

MIT © [Tran Duc Duy](https://github.com/tdduydev)
