const { getDb } = require('../lib/firebase');
const { hashToken } = require('../lib/auth');
const { sanitizeHtml } = require('../lib/sanitize');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, token, id } = req.query;
    if (!email || !token || !id) {
      return res.status(400).json({ error: 'email, token and id required' });
    }

    const localPart = email.split('@')[0];
    const db = getDb();
    const inboxSnap = await db.collection('inboxes').doc(localPart).get();

    if (!inboxSnap.exists) return res.status(404).json({ error: 'Inbox not found' });
    const inbox = inboxSnap.data();
    if (inbox.tokenHash !== hashToken(token)) return res.status(403).json({ error: 'Invalid token' });
    if (Date.now() > inbox.expiresAt) return res.status(410).json({ error: 'Inbox expired' });

    const msgSnap = await db.collection('inboxes').doc(localPart).collection('messages').doc(id).get();
    if (!msgSnap.exists) return res.status(404).json({ error: 'Message not found' });

    const msg = msgSnap.data();
    res.status(200).json({
      id: msgSnap.id,
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text || '',
      html: sanitizeHtml(msg.html || ''),
      receivedAt: msg.receivedAt,
      otp: msg.otp || null
    });
  } catch (err) {
    console.error('Message error:', err);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
};