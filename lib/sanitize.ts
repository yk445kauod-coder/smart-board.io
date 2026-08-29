import DOMPurify from 'dompurify';

// Allow safe rich-text tags the AI/docs may use (bold, lists, math-ish spans),
// strip script/iframe/on* attributes and javascript: URLs.
export const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'br', 'ul', 'ol', 'li', 'p', 'div', 'span', 'sub', 'sup', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
export const ALLOWED_ATTR = ['dir', 'style', 'align', 'class'];

const purifyOptions = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'svg', 'math', 'style'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress', 'style', 'src', 'href', 'xlink:href'],
};

export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  // Strip javascript:/data: URLs defensively before purify
  const stripped = html
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*("|')\s*(javascript|data|vbscript)\s*:/gi, '$1=$2$3:');
  return DOMPurify.sanitize(stripped, purifyOptions);
};

// Text extraction used before injecting AI/doc content into the DOM.
export const textOnly = (s: unknown): string => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Conservative length cap for untrusted doc text before prompt injection.
export const MAX_PROMPT_TEXT =5600;

export const truncateForPrompt = (text: string, max = MAX_PROMPT_TEXT): string => {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
};

// Strip potential instruction-injection markers from document text.
export const neutralizeDocText = (text: string): string => {
  return truncateForPrompt(text)
    .replace(/\b(ignore|disregard|forget|follow)\s+(above|previous|prior|all)\s+(instructions|prompts|commands)/gi, '$1 $2 text')
    .replace(/[\u0000-\u001F\u007F]/g, ' ');
};