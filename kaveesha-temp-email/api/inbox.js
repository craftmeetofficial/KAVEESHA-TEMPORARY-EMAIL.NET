const { getDb } = require('../lib/firebase');
const { hashToken } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, token } = req.query;
    if (!email || !token) {
      return res.status(400).json({ error: 'email and token required' });
    }

    const localPart = email.split('@')[0];
    const db = getDb();
    const inboxRef = db.collection('inboxes').doc(localPart);
    const inboxSnap = await inboxRef.get();

    if (!inboxSnap.exists) {
      return res.status(404).json({ error: 'Inbox not found or expired' });
    }

    const inbox = inboxSnap.data();
    if (inbox.tokenHash !== hashToken(token)) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    if (Date.now() > inbox.expiresAt) {
      // Auto cleanup
      await deleteInbox(db, localPart);
      return res.status(410).json({ error: 'Inbox expired' });
    }

    const messagesSnap = await db
      .collection('inboxes')
      .doc(localPart)
      .collection('messages')
      .orderBy('receivedAt', 'desc')
      .limit(50)
      .get();

    const messages = messagesSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        from: data.from,
        subject: data.subject,
        preview: data.preview,
        receivedAt: data.receivedAt,
        hasHtml: !!data.html,
        otp: data.otp || null
      };
    });

    res.status(200).json({
      email: inbox.email,
      expiresAt: inbox.expiresAt,
      messageCount: messages.length,
      messages
    });
  } catch (err) {
    console.error('Inbox error:', err);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
};

async function deleteInbox(db, localPart) {
  const messages = await db.collection('inboxes').doc(localPart).collection('messages').get();
  const batch = db.batch();
  messages.docs.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection('inboxes').doc(localPart));
  await batch.commit();
}