import { Hono } from 'hono';

// ─── In-memory platform settings ────────────────────────────
export interface PlatformSettings {
  /** AI response language code, e.g. 'vi', 'en', 'ja', 'zh', 'ko', 'auto' */
  aiLanguage: string;
  /** Custom language instruction (overrides preset if non-empty) */
  aiLanguageCustom: string;
}

const settings: PlatformSettings = {
  aiLanguage: 'auto',
  aiLanguageCustom: '',
};

// Preset language map
const LANGUAGE_MAP: Record<string, string> = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  zh: 'Chinese Simplified (简体中文)',
  'zh-tw': 'Chinese Traditional (繁體中文)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  es: 'Spanish (Español)',
  pt: 'Portuguese (Português)',
  it: 'Italian (Italiano)',
  ru: 'Russian (Русский)',
  th: 'Thai (ภาษาไทย)',
  id: 'Indonesian (Bahasa Indonesia)',
  ms: 'Malay (Bahasa Melayu)',
  ar: 'Arabic (العربية)',
  hi: 'Hindi (हिन्दी)',
};

export function getLanguageInstruction(): string {
  if (settings.aiLanguage === 'auto') return '';
  if (settings.aiLanguageCustom.trim()) return settings.aiLanguageCustom.trim();
  const langName = LANGUAGE_MAP[settings.aiLanguage];
  if (langName) return `You MUST respond in ${langName}. All your responses, explanations, and outputs must be written in ${langName}.`;
  return '';
}

export function getSettings(): PlatformSettings {
  return { ...settings };
}

export function createSettingsRoutes() {
  const app = new Hono();

  // GET /settings — Get current platform settings
  app.get('/', (c) => {
    return c.json({
      ...settings,
      languages: Object.entries(LANGUAGE_MAP).map(([code, name]) => ({ code, name })),
    });
  });

  // PUT /settings — Update platform settings
  app.put('/', async (c) => {
    const body = await c.req.json<Partial<PlatformSettings>>();
    if (body.aiLanguage !== undefined) {
      const lang = String(body.aiLanguage).toLowerCase().trim();
      if (lang === 'auto' || lang in LANGUAGE_MAP) {
        settings.aiLanguage = lang;
      }
    }
    if (body.aiLanguageCustom !== undefined) {
      settings.aiLanguageCustom = String(body.aiLanguageCustom).slice(0, 500);
    }
    return c.json({ ok: true, settings: { ...settings } });
  });

  return app;
}
