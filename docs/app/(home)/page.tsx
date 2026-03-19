import Link from 'next/link';
import {
  SkillIcon,
  WorkflowIcon,
  LLMIcon,
  AgentHubIcon,
  MemoryIcon,
  DockerIcon,
  ChannelIcon,
  TypeScriptIcon,
} from '@/components/icons';

const features = [
  {
    icon: <SkillIcon />,
    title: 'Pluggable Skill System',
    description:
      '11+ ready-to-use AI agent skill packs — from Programming & DevOps to Healthcare, Finance, and Design.',
    color: '#06b6d4',
  },
  {
    icon: <WorkflowIcon />,
    title: 'Visual Workflow Builder',
    description:
      'Drag-and-drop workflow canvas with 16 node types. Build complex AI automations without code.',
    color: '#7c3aed',
  },
  {
    icon: <LLMIcon />,
    title: 'Multi-LLM Support',
    description:
      'OpenAI, Anthropic Claude, Ollama, Google, Groq, Mistral — switch with a single config change.',
    color: '#06b6d4',
  },
  {
    icon: <AgentHubIcon />,
    title: 'Agent Hub Marketplace',
    description:
      'Browse, install, and manage AI agents. Configure with Skill Studio — toggle tools, set params.',
    color: '#7c3aed',
  },
  {
    icon: <MemoryIcon />,
    title: 'Semantic Memory & RAG',
    description:
      'Two-tier memory + RAG engine. Vector search with cosine similarity across sessions.',
    color: '#06b6d4',
  },
  {
    icon: <DockerIcon />,
    title: 'Docker Ready',
    description:
      'One-command deployment with Docker Compose. Multi-stage build for production.',
    color: '#7c3aed',
  },
  {
    icon: <ChannelIcon />,
    title: 'Multi-Channel',
    description:
      'Telegram, Discord, REST API, WebSocket, CLI — connect your agent everywhere.',
    color: '#06b6d4',
  },
  {
    icon: <TypeScriptIcon />,
    title: 'TypeScript Native',
    description:
      'Built in TypeScript with full type safety. Clean npm workspaces monorepo.',
    color: '#7c3aed',
  },
];

const techStack = [
  { name: 'TypeScript', color: '#3178C6' },
  { name: 'React 19', color: '#61DAFB' },
  { name: 'Node.js', color: '#339933' },
  { name: 'Vite 6', color: '#646CFF' },
  { name: 'Express 5', color: '#F59E0B' },
  { name: 'Docker', color: '#2496ED' },
  { name: 'Tailwind CSS', color: '#06B6D4' },
  { name: 'React Flow', color: '#FF0072' },
];

const stats = [
  { label: 'Packages', value: '14' },
  { label: 'LLM Providers', value: '7' },
  { label: 'Skill Packs', value: '11+' },
  { label: 'Node Types', value: '16' },
];

export default function HomePage() {
  return (
    <main>
      {/* ════════ HERO ════════ */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-40 text-center relative z-10">
          {/* Floating orbs */}
          <div className="absolute top-16 left-8 w-72 h-72 rounded-full bg-[#06b6d4] opacity-[0.06] blur-[100px] animate-float" />
          <div className="absolute bottom-16 right-8 w-80 h-80 rounded-full bg-[#7c3aed] opacity-[0.06] blur-[100px] animate-float" style={{ animationDelay: '3s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#4f46e5] opacity-[0.04] blur-[120px] animate-float" style={{ animationDelay: '6s' }} />

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/50 backdrop-blur-md px-5 py-2 text-sm text-fd-muted-foreground mb-10 animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            Open Source · MIT License · v2.0
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-8 animate-fade-in-up delay-100" style={{ opacity: 0 }}>
            <img src="/logo.png" alt="xClaw" width={96} height={96} className="rounded-2xl" style={{ filter: 'drop-shadow(0 0 40px rgba(6, 182, 212, 0.3))' }} />
          </div>

          {/* Title */}
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-5 animate-fade-in-up delay-200" style={{ opacity: 0 }}>
            <span className="text-gradient">xClaw</span>
          </h1>
          <p className="text-xl md:text-2xl font-semibold text-fd-muted-foreground mb-3 animate-fade-in-up delay-300" style={{ opacity: 0 }}>
            AI Agent Platform
          </p>
          <p className="text-base md:text-lg text-fd-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-400" style={{ opacity: 0 }}>
            Open-source TypeScript monorepo. Pluggable skills, visual workflows,<br className="hidden md:block" />
            multi-LLM support — build and deploy AI agents in minutes.
          </p>

          {/* Terminal snippet */}
          <div className="glass-terminal inline-block px-6 py-4 text-sm text-left mb-10 animate-fade-in-up delay-500" style={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57]"></span>
              <span className="w-3 h-3 rounded-full bg-[#febc2e]"></span>
              <span className="w-3 h-3 rounded-full bg-[#28c840]"></span>
            </div>
            <div className="space-y-1">
              <div>
                <code className="text-[#06b6d4]">
                  <span className="text-fd-muted-foreground">$</span>{' '}
                  <span className="text-emerald-400">git clone</span>{' '}
                  <span className="text-white/90">https://github.com/tdduydev/xClaw.git</span>
                </code>
              </div>
              <div>
                <code className="text-[#06b6d4]">
                  <span className="text-fd-muted-foreground">$</span>{' '}
                  <span className="text-emerald-400">cp</span>{' '}
                  <span className="text-white/90">.env.example .env</span>{' '}
                  <span className="text-fd-muted-foreground"># add your API keys</span>
                </code>
              </div>
              <div>
                <code className="text-[#06b6d4]">
                  <span className="text-fd-muted-foreground">$</span>{' '}
                  <span className="text-emerald-400">docker compose</span>{' '}
                  <span className="text-[#7c3aed]">up -d</span>{' '}
                  <span className="text-fd-muted-foreground">🚀</span>
                </code>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-600" style={{ opacity: 0 }}>
            <Link
              href="/docs/getting-started"
              className="btn-glow inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white shadow-lg"
            >
              Get Started
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="https://github.com/tdduydev/xClaw"
              className="inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card/50 backdrop-blur-md px-8 py-4 text-base font-semibold text-fd-foreground transition-all hover:bg-fd-muted/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ STATS ════════ */}
      <section className="relative z-10 -mt-10">
        <div className="mx-auto max-w-3xl px-6">
          <div className="glass-card grid grid-cols-2 md:grid-cols-4 gap-0 py-6 px-4">
            {stats.map((stat, i) => (
              <div key={i} className="text-center px-4" style={{ borderRight: i < stats.length - 1 ? '1px solid hsl(var(--color-fd-border))' : undefined }}>
                <div className="text-2xl md:text-3xl font-extrabold text-gradient">{stat.value}</div>
                <div className="text-xs md:text-sm text-fd-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FEATURES ════════ */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-5">
            Everything you need to build{' '}
            <span className="text-gradient">AI Agents</span>
          </h2>
          <p className="text-fd-muted-foreground text-lg max-w-2xl mx-auto">
            A complete platform for creating, deploying, and managing intelligent agents
            with a powerful, extensible toolkit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <div
              key={i}
              className="glass-card p-6 flex flex-col gap-4 animate-fade-in-up"
              style={{ opacity: 0, animationDelay: `${i * 100}ms` }}
            >
              <div className="icon-ring">
                {feature.icon}
              </div>
              <h3 className="font-bold text-lg">{feature.title}</h3>
              <p className="text-fd-muted-foreground text-sm leading-relaxed flex-1">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════ DIVIDER ════════ */}
      <div className="section-divider" />

      {/* ════════ TECH STACK ════════ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-10">
            Powered by <span className="text-gradient">Modern Tech</span>
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {techStack.map((tech, i) => (
              <div
                key={i}
                className="tech-pill"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: tech.color, boxShadow: `0 0 8px ${tech.color}50` }}
                />
                {tech.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ DIVIDER ════════ */}
      <div className="section-divider" />

      {/* ════════ CTA ════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-5">
            Ready to build your{' '}
            <span className="text-gradient">AI Agent</span>?
          </h2>
          <p className="text-fd-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Get started in under 5 minutes. Free and open source forever.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/docs/getting-started"
              className="btn-glow inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white shadow-lg"
            >
              Get Started →
            </Link>
            <Link
              href="/docs/architecture"
              className="inline-flex items-center gap-2 rounded-xl border border-fd-border bg-fd-card/50 backdrop-blur-md px-8 py-4 text-base font-semibold text-fd-foreground transition-all hover:bg-fd-muted/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              View Architecture
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="py-10">
        <div className="section-divider mb-10" />
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-fd-muted-foreground">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="xClaw" width={24} height={24} className="rounded-md" />
            <span>
              MIT © <a href="https://github.com/tdduydev" className="hover:text-fd-foreground transition-colors">Tran Duc Duy</a>
            </span>
          </div>
          <p>
            Built with ❤️ by{' '}
            <a href="https://xdev.asia" className="hover:text-fd-foreground transition-colors">
              xDev.asia
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
