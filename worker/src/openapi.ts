const json = (schema: Record<string, unknown>) => ({ 'application/json': { schema } });
const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });

const error = {
  type: 'object',
  properties: { error: { type: 'string' }, requestId: { type: 'string' } },
  required: ['error'],
};

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'SmartBoard AI API',
    version: '1.0.0',
    description:
      'Bilingual classroom whiteboard API. Generate streamed lesson protocols, save lessons, manage workspaces, API keys, billing, and use the MCP server.',
    contact: { name: 'SmartBoard AI', url: 'https://smartboard.ai' },
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'Current origin' }],
  tags: [
    { name: 'Auth' },
    { name: 'Lessons' },
    { name: 'AI' },
    { name: 'API keys' },
    { name: 'Billing' },
    { name: 'Admin' },
    { name: 'MCP' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key: sb_live_…' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sb_session' },
    },
    schemas: {
      Error: error,
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' },
          createdAt: { type: 'number' }, isPlatformAdmin: { type: 'boolean' }, status: { type: 'string' },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, slug: { type: 'string' },
          plan: { type: 'string', enum: ['free', 'pro', 'school', 'enterprise'] },
          status: { type: 'string' }, owner_id: { type: 'string' },
        },
      },
      ProtocolScript: {
        type: 'object',
        properties: {
          title: { type: 'string' }, lang: { type: 'string' },
          steps: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, say: { type: 'string' }, ops: { type: 'array', items: { type: 'object' } } } } },
        },
        required: ['steps'],
      },
      Lesson: {
        type: 'object',
        properties: {
          id: { type: 'string' }, title: { type: 'string' }, lang: { type: 'string' },
          script: ref('ProtocolScript'), createdAt: { type: 'number' }, updatedAt: { type: 'number' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, prefix: { type: 'string' }, scopes: { type: 'string' }, createdAt: { type: 'number' } },
      },
      Plan: {
        type: 'object',
        properties: {
          id: { type: 'string' }, name: { type: 'string' }, priceEgp: { type: 'number' }, seats: { type: 'number' },
          dailyChats: { type: 'number' }, maxLessons: { type: 'number' }, features: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    '/health': { get: { tags: ['Auth'], summary: 'Health check', security: [], responses: { '200': { description: 'OK' }, '503': { description: 'D1 unavailable' } } } },
    '/v1/models': {
      get: {
        tags: ['AI'], summary: 'List models and provider availability', security: [],
        responses: { '200': { description: 'Models', content: json({ type: 'object', properties: { models: { type: 'array', items: { type: 'object' } } } }) } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Create an account and personal workspace', security: [],
        requestBody: { required: true, content: json({ type: 'object', properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 }, name: { type: 'string' } }, required: ['email', 'password'] }) },
        responses: { '201': { description: 'Created' }, '409': { description: 'Email exists', content: json(ref('Error')) } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Sign in (sets sb_session cookie)', security: [],
        requestBody: { required: true, content: json({ type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } }, required: ['email', 'password'] }) },
        responses: { '200': { description: 'OK' }, '401': { description: 'Bad credentials' }, '429': { description: 'Rate limited' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'], summary: 'Current user, workspace, and plan',
        responses: { '200': { description: 'OK', content: json({ type: 'object', properties: { user: ref('User'), org: ref('Organization'), plan: ref('Plan') } }) }, '401': { description: 'Unauthorized' } },
      },
    },
    '/v1/lessons': {
      get: { tags: ['Lessons'], summary: 'List workspace lessons', responses: { '200': { description: 'OK' } } },
      post: {
        tags: ['Lessons'], summary: 'Create a lesson',
        requestBody: { required: true, content: json({ type: 'object', properties: { title: { type: 'string' }, lang: { type: 'string' }, script: ref('ProtocolScript') }, required: ['script'] }) },
        responses: { '201': { description: 'Created' }, '400': { description: 'Invalid script' }, '402': { description: 'Plan limit reached' } },
      },
    },
    '/v1/lessons/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: { tags: ['Lessons'], summary: 'Get a lesson', responses: { '200': { description: 'OK', content: json(ref('Lesson')) }, '404': { description: 'Not found' } } },
      put: { tags: ['Lessons'], summary: 'Update a lesson', responses: { '200': { description: 'OK' } } },
      delete: { tags: ['Lessons'], summary: 'Delete a lesson', responses: { '200': { description: 'OK' } } },
    },
    '/v1/chat/stream': {
      post: {
        tags: ['AI'], summary: 'Stream a lesson as SSE',
        description: 'SSE events: meta, provider, delta, op, step, warning, done, error. Use model "auto" for OmniRouter.',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            properties: {
              model: { type: 'string', default: 'auto' },
              messages: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, content: { type: 'string' } } } },
              mode: { type: 'string', enum: ['lesson', 'continue'] },
              lang: { type: 'string' }, extended: { type: 'boolean' }, maxTokens: { type: 'number' },
            },
            required: ['model', 'messages'],
          }),
        },
        responses: { '200': { description: 'SSE stream', content: { 'text/event-stream': { schema: { type: 'string' } } } }, '402': { description: 'Daily limit' }, '503': { description: 'No provider' } },
      },
    },
    '/v1/api-keys': {
      get: { tags: ['API keys'], summary: 'List API keys', responses: { '200': { description: 'OK' } } },
      post: {
        tags: ['API keys'], summary: 'Create an API key (raw key returned once)',
        requestBody: { required: true, content: json({ type: 'object', properties: { name: { type: 'string' }, scopes: { type: 'string' } } }) },
        responses: { '201': { description: 'Created' }, '402': { description: 'Plan limit' } },
      },
    },
    '/v1/api-keys/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      delete: { tags: ['API keys'], summary: 'Revoke an API key', responses: { '200': { description: 'OK' } } },
    },
    '/v1/billing/plans': { get: { tags: ['Billing'], summary: 'Public plans', security: [], responses: { '200': { description: 'OK' } } } },
    '/v1/billing/subscription': { get: { tags: ['Billing'], summary: 'Current subscription', responses: { '200': { description: 'OK' } } } },
    '/v1/billing/checkout': { post: { tags: ['Billing'], summary: 'Create Stripe Checkout session', responses: { '200': { description: 'OK' }, '503': { description: 'Billing not configured' } } } },
    '/v1/billing/portal': { post: { tags: ['Billing'], summary: 'Create Stripe billing portal session', responses: { '200': { description: 'OK' } } } },
    '/v1/billing/webhook': { post: { tags: ['Billing'], summary: 'Stripe webhook', security: [], responses: { '200': { description: 'OK' } } } },
    '/v1/push/public-key': { get: { tags: ['Push'], summary: 'VAPID public key', security: [], responses: { '200': { description: 'OK' } } } },
    '/v1/push/subscribe': {
      post: { tags: ['Push'], summary: 'Register a Web Push subscription', responses: { '200': { description: 'OK' }, '400': { description: 'Invalid subscription' } } },
      delete: { tags: ['Push'], summary: 'Revoke a Web Push subscription', responses: { '200': { description: 'OK' } } },
    },
    '/v1/push/test': { post: { tags: ['Push'], summary: 'Send a test notification', responses: { '200': { description: 'OK' }, '503': { description: 'Push not configured' } } } },
    '/v1/admin/overview': { get: { tags: ['Admin'], summary: 'Platform KPIs (platform admin only)', responses: { '200': { description: 'OK' }, '403': { description: 'Forbidden' } } } },
    '/v1/admin/users': { get: { tags: ['Admin'], summary: 'List users', responses: { '200': { description: 'OK' } } } },
    '/v1/admin/orgs': { get: { tags: ['Admin'], summary: 'List workspaces', responses: { '200': { description: 'OK' } } } },
    '/v1/admin/orgs/{id}': { patch: { tags: ['Admin'], summary: 'Change plan/status', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
    '/v1/admin/audit': { get: { tags: ['Admin'], summary: 'Audit log', responses: { '200': { description: 'OK' } } } },
    '/mcp': {
      get: { tags: ['MCP'], summary: 'MCP server metadata', responses: { '200': { description: 'OK' } } },
      post: { tags: ['MCP'], summary: 'MCP JSON-RPC (initialize, tools/list, tools/call)', responses: { '200': { description: 'JSON-RPC response' } } },
    },
  },
};
