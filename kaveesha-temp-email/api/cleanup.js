const { getDb } = require('../lib/firebase');

module.exports = async (req, res) => {
  // Protect with a secret header in production
  if (req.headers['x-cleanup-secret'] !== process.env.CLEANUP_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const db = getDb();
    const now = Date.now();
    const expired = await db.collection('inboxes')
      .where('expiresAt', '<', now)
      .limit(50)
      .get();

    let deleted = 0;
    for (const doc of expired.docs) {
      const messages = await doc.ref.collection('messages').get();
      const batch = db.batch();
      messages.docs.forEach(m => batch.delete(m.ref));
      batch.delete(doc.ref);
      await batch.commit();
      deleted++;
    }

    res.status(200).json({ deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cleanup failed' });
  }
};