import type { Env } from './env';

export type ProviderKind =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'workers-ai'
  | 'pollinations'
  | 'freellmapi'
  | 'omni';

export type ModelTier = 'keyless' | 'free' | 'premium';

export interface ModelDef {
  id: string;
  label: string;
  provider: ProviderKind;
  /** Model id sent upstream (may differ from our public id). */
  upstream: string;
  /** Base URL for OpenAI-compatible providers. */
  baseUrl?: string;
  /** Which Worker secret holds the key. */
  keyEnv?: keyof Env;
  capabilities: { streaming: boolean; json: boolean; vision?: boolean };
  contextWindow?: number;
  tier?: ModelTier;
  keyless?: boolean;
}

/**
 * Public model registry. Add or remove entries freely; the UI reads this list
 * from GET /v1/models. Keep ids stable because lessons store the chosen id.
 */
export const MODELS: ModelDef[] = [
  {
    id: 'auto',
    label: 'OmniRouter (auto)',
    provider: 'omni',
    upstream: 'auto',
    capabilities: { streaming: true, json: true, vision: false },
    contextWindow: 1_000_000,
    tier: 'keyless',
    keyless: true,
  },
  {
    id: 'pollinations/openai',
    label: 'Pollinations (keyless)',
    provider: 'pollinations',
    upstream: 'openai',
    baseUrl: 'https://text.pollinations.ai/openai',
    capabilities: { streaming: true, json: true },
    contextWindow: 32_000,
    tier: 'keyless',
    keyless: true,
  },
  {
    id: 'freellmapi/auto',
    label: 'FreeLLMAPI (self-hosted)',
    provider: 'freellmapi',
    upstream: 'auto',
    keyEnv: 'FREELLMAPI_API_KEY',
    capabilities: { streaming: true, json: true },
    contextWindow: 128_000,
    tier: 'free',
  },

  {
    id: 'openrouter/google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (OpenRouter)',
    provider: 'openrouter',
    upstream: 'google/gemini-2.5-flash',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    capabilities: { streaming: true, json: true, vision: true },
    contextWindow: 1_000_000,
    tier: 'premium',
  },
  {
    id: 'openrouter/anthropic/claude-3.5-haiku',
    label: 'Claude 3.5 Haiku (OpenRouter)',
    provider: 'openrouter',
    upstream: 'anthropic/claude-3.5-haiku',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    capabilities: { streaming: true, json: true, vision: true },
    contextWindow: 200_000,
    tier: 'premium',
  },
  {
    id: 'openrouter/deepseek/deepseek-chat',
    label: 'DeepSeek Chat (OpenRouter)',
    provider: 'openrouter',
    upstream: 'deepseek/deepseek-chat',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    capabilities: { streaming: true, json: true },
    contextWindow: 64_000,
    tier: 'free',
  },
  {
    id: 'openrouter/meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B (OpenRouter)',
    provider: 'openrouter',
    upstream: 'meta-llama/llama-3.3-70b-instruct',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    capabilities: { streaming: true, json: true },
    contextWindow: 131_000,
    tier: 'free',
  },
  {
    id: 'gemini/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Google)',
    provider: 'gemini',
    upstream: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    capabilities: { streaming: true, json: true, vision: true },
    contextWindow: 1_000_000,
    tier: 'premium',
  },
  {
    id: 'deepseek/deepseek-chat',
    label: 'DeepSeek Chat (direct)',
    provider: 'deepseek',
    upstream: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    keyEnv: 'DEEPSEEK_API_KEY',
    capabilities: { streaming: true, json: true },
    contextWindow: 64_000,
    tier: 'premium',
  },
  {
    id: 'anthropic/claude-3-5-haiku-latest',
    label: 'Claude 3.5 Haiku (Anthropic)',
    provider: 'anthropic',
    upstream: 'claude-3-5-haiku-latest',
    keyEnv: 'ANTHROPIC_API_KEY',
    capabilities: { streaming: true, json: true, vision: true },
    contextWindow: 200_000,
    tier: 'premium',
  },
  {
    id: 'workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    label: 'Llama 3.3 70B (Workers AI)',
    provider: 'workers-ai',
    upstream: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    capabilities: { streaming: true, json: true },
    contextWindow: 24_000,
    tier: 'keyless',
    keyless: true,
  },
];

export const getModel = (id: string): ModelDef | undefined => MODELS.find((m) => m.id === id);

export const publicModels = () =>
  MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    capabilities: m.capabilities,
    contextWindow: m.contextWindow,
    tier: m.tier,
    keyless: m.keyless,
  }));
