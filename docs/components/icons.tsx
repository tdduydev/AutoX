import React from 'react';

const gradientDefs = (id: string) => (
  <defs>
    <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="24" y2="24">
      <stop offset="0%" stopColor="#06b6d4" />
      <stop offset="100%" stopColor="#4f46e5" />
    </linearGradient>
  </defs>
);

interface IconProps {
  className?: string;
  size?: number;
}

export function SkillIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('skill')}
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="url(#skill-grad)" strokeWidth="1.5" fill="url(#skill-grad)" fillOpacity="0.15" />
      <path d="M12 6l-5 3v6l5 3 5-3V9l-5-3z" fill="url(#skill-grad)" fillOpacity="0.3" />
      <circle cx="12" cy="12" r="2" fill="url(#skill-grad)" />
    </svg>
  );
}

export function WorkflowIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('workflow')}
      <rect x="2" y="3" width="6" height="4" rx="1" fill="url(#workflow-grad)" fillOpacity="0.3" stroke="url(#workflow-grad)" strokeWidth="1.5" />
      <rect x="9" y="10" width="6" height="4" rx="1" fill="url(#workflow-grad)" fillOpacity="0.3" stroke="url(#workflow-grad)" strokeWidth="1.5" />
      <rect x="16" y="17" width="6" height="4" rx="1" fill="url(#workflow-grad)" fillOpacity="0.3" stroke="url(#workflow-grad)" strokeWidth="1.5" />
      <path d="M8 5h3v5M15 12h3v5" stroke="url(#workflow-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LLMIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('llm')}
      <circle cx="12" cy="12" r="9" stroke="url(#llm-grad)" strokeWidth="1.5" fill="url(#llm-grad)" fillOpacity="0.1" />
      <circle cx="12" cy="8" r="2" fill="url(#llm-grad)" />
      <circle cx="8" cy="14" r="2" fill="url(#llm-grad)" fillOpacity="0.7" />
      <circle cx="16" cy="14" r="2" fill="url(#llm-grad)" fillOpacity="0.7" />
      <path d="M12 10v2M10 13l-1 0M14 13l1 0" stroke="url(#llm-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function AgentHubIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('agenthub')}
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="url(#agenthub-grad)" strokeWidth="1.5" fill="url(#agenthub-grad)" fillOpacity="0.1" />
      <rect x="6" y="6" width="5" height="5" rx="1.5" fill="url(#agenthub-grad)" fillOpacity="0.4" />
      <rect x="13" y="6" width="5" height="5" rx="1.5" fill="url(#agenthub-grad)" fillOpacity="0.25" />
      <rect x="6" y="13" width="5" height="5" rx="1.5" fill="url(#agenthub-grad)" fillOpacity="0.25" />
      <rect x="13" y="13" width="5" height="5" rx="1.5" fill="url(#agenthub-grad)" fillOpacity="0.4" />
    </svg>
  );
}

export function MemoryIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('memory')}
      <circle cx="12" cy="12" r="3" fill="url(#memory-grad)" />
      <circle cx="12" cy="12" r="7" stroke="url(#memory-grad)" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
      <circle cx="12" cy="12" r="10" stroke="url(#memory-grad)" strokeWidth="1" fill="none" strokeDasharray="2 3" opacity="0.5" />
      <circle cx="12" cy="5" r="1.5" fill="url(#memory-grad)" fillOpacity="0.6" />
      <circle cx="18" cy="9" r="1.5" fill="url(#memory-grad)" fillOpacity="0.6" />
      <circle cx="6" cy="15" r="1.5" fill="url(#memory-grad)" fillOpacity="0.6" />
    </svg>
  );
}

export function DockerIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('docker')}
      <path d="M4 14c0-2 1-3 3-3h10c2 0 3 1 3 3v4c0 1-1 2-2 2H6c-1 0-2-1-2-2v-4z" stroke="url(#docker-grad)" strokeWidth="1.5" fill="url(#docker-grad)" fillOpacity="0.15" />
      <rect x="6" y="8" width="3" height="3" rx="0.5" fill="url(#docker-grad)" fillOpacity="0.3" />
      <rect x="10" y="8" width="3" height="3" rx="0.5" fill="url(#docker-grad)" fillOpacity="0.4" />
      <rect x="14" y="8" width="3" height="3" rx="0.5" fill="url(#docker-grad)" fillOpacity="0.3" />
      <rect x="10" y="4" width="3" height="3" rx="0.5" fill="url(#docker-grad)" fillOpacity="0.2" />
      <path d="M21 13c-1-2-3-2-3-2" stroke="url(#docker-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChannelIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('channel')}
      <circle cx="12" cy="12" r="3" fill="url(#channel-grad)" />
      <circle cx="5" cy="5" r="2" fill="url(#channel-grad)" fillOpacity="0.5" />
      <circle cx="19" cy="5" r="2" fill="url(#channel-grad)" fillOpacity="0.5" />
      <circle cx="5" cy="19" r="2" fill="url(#channel-grad)" fillOpacity="0.5" />
      <circle cx="19" cy="19" r="2" fill="url(#channel-grad)" fillOpacity="0.5" />
      <path d="M7 7l3 3M17 7l-3 3M7 17l3-3M17 17l-3-3" stroke="url(#channel-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TypeScriptIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('ts')}
      <rect x="2" y="2" width="20" height="20" rx="3" stroke="url(#ts-grad)" strokeWidth="1.5" fill="url(#ts-grad)" fillOpacity="0.1" />
      <text x="12" y="16" textAnchor="middle" fill="url(#ts-grad)" fontSize="10" fontWeight="bold" fontFamily="Inter, system-ui, sans-serif">TS</text>
    </svg>
  );
}

export function GatewayIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('gateway')}
      <path d="M12 2v6M12 16v6" stroke="url(#gateway-grad)" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6" y="8" width="12" height="8" rx="2" stroke="url(#gateway-grad)" strokeWidth="1.5" fill="url(#gateway-grad)" fillOpacity="0.15" />
      <circle cx="9" cy="12" r="1.5" fill="url(#gateway-grad)" />
      <circle cx="15" cy="12" r="1.5" fill="url(#gateway-grad)" />
      <path d="M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4" stroke="url(#gateway-grad)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function CLIIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('cli')}
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="url(#cli-grad)" strokeWidth="1.5" fill="url(#cli-grad)" fillOpacity="0.1" />
      <path d="M6 9l3 3-3 3" stroke="url(#cli-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15h6" stroke="url(#cli-grad)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HealthcareIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('health')}
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#health-grad)" fillOpacity="0.2" stroke="url(#health-grad)" strokeWidth="1.5" />
      <path d="M10 10h4M12 8v4" stroke="url(#health-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProgrammingIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('prog')}
      <path d="M8 6l-6 6 6 6" stroke="url(#prog-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6l6 6-6 6" stroke="url(#prog-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4l-4 16" stroke="url(#prog-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EventBusIcon({ className, size = 40 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {gradientDefs('event')}
      <path d="M4 12h16" stroke="url(#event-grad)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="4" cy="6" r="2" fill="url(#event-grad)" fillOpacity="0.5" />
      <circle cx="12" cy="6" r="2" fill="url(#event-grad)" fillOpacity="0.5" />
      <circle cx="20" cy="6" r="2" fill="url(#event-grad)" fillOpacity="0.5" />
      <circle cx="4" cy="18" r="2" fill="url(#event-grad)" fillOpacity="0.5" />
      <circle cx="12" cy="18" r="2" fill="url(#event-grad)" fillOpacity="0.5" />
      <circle cx="20" cy="18" r="2" fill="url(#event-grad)" fillOpacity="0.5" />
      <path d="M4 8v4M12 8v4M20 8v4M4 14v4M12 14v4M20 14v4" stroke="url(#event-grad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
