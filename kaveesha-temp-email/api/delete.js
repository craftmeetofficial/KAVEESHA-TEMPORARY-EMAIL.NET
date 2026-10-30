const { getDb } = require('../lib/firebase');
const { hashToken } = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, token, messageId, deleteAll } = req.body || {};
    if (!email || !token) {
      return res.status(400).json({ error: 'email and token required' });
    }

    const localPart = email.split('@')[0];
    const db = getDb();
    const inboxRef = db.collection('inboxes').doc(localPart);
    const inboxSnap = await inboxRef.get();

    if (!inboxSnap.exists) return res.status(404).json({ error: 'Inbox not found' });
    const inbox = inboxSnap.data();
    if (inbox.tokenHash !== hashToken(token)) return res.status(403).json({ error: 'Invalid token' });

    if (deleteAll || !messageId) {
      // Delete entire inbox
      const messages = await inboxRef.collection('messages').get();
      const batch = db.batch();
      messages.docs.forEach(d => batch.delete(d.ref));
      batch.delete(inboxRef);
      await batch.commit();
      return res.status(200).json({ success: true, deleted: 'inbox' });
    }

    // Delete single message
    await inboxRef.collection('messages').doc(messageId).delete();
    res.status(200).json({ success: true, deleted: messageId });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
};