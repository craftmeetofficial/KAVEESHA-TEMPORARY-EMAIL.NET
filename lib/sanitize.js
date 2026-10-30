const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeHtml(dirty) {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
  });
}

function extractOTP(text) {
  if (!text) return null;
  // Common OTP patterns
  const patterns = [
    /\b(\d{4,8})\b/,                          // 4-8 digit code
    /(?:code|otp|pin|verification|verify)[:\s]*(\d{4,8})/i,
    /(?:is|code is)[:\s]*(\d{4,8})/i,
    /(\d{3}[-\s]?\d{3})/,                     // 6 digit with separator
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].replace(/[-\s]/g, '');
  }
  return null;
}

module.exports = { sanitizeHtml, extractOTP };