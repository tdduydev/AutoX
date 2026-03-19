import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'xClaw — AI Agent Platform',
    template: '%s | xClaw',
  },
  description:
    'Open-source AI Agent Platform with pluggable skills, visual workflows, multi-LLM support, and multi-channel connectivity. Build and deploy AI agents in minutes.',
  keywords: [
    'AI Agent',
    'AI Platform',
    'LLM',
    'Workflow Builder',
    'TypeScript',
    'Open Source',
    'Multi-Agent',
    'xClaw',
    'ChatBot',
    'Automation',
  ],
  authors: [{ name: 'xDev.asia', url: 'https://xdev.asia' }],
  creator: 'Tran Duc Duy',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://xclaw.xdev.asia',
    title: 'xClaw — AI Agent Platform',
    description:
      'Open-source AI Agent Platform with pluggable skills, visual workflows, multi-LLM support.',
    siteName: 'xClaw',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'xClaw — AI Agent Platform',
    description:
      'Open-source AI Agent Platform with pluggable skills, visual workflows, multi-LLM support.',
  },
  metadataBase: new URL('https://xclaw.xdev.asia'),
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
