
const { getDb } = require('../lib/firebase');
const {
  generateSecureToken,
  generateLocalPart,
  hashToken
} = require('../lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    // Check environment variables
    if (!process.env.DOMAIN) {
      throw new Error('DOMAIN environment variable is missing');
    }

    const db = getDb();

    const domain = process.env.DOMAIN;
    const expirationMinutes = parseInt(
      process.env.INBOX_EXPIRATION_MINUTES || '10',
      10
    );

    if (!Number.isFinite(expirationMinutes) || expirationMinutes <= 0) {
      throw new Error('Invalid inbox expiration setting');
    }

    let localPart;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 8) {
      localPart = generateLocalPart(10);

      if (!localPart) {
        throw new Error('Failed to generate email address');
      }

      const snap = await db
        .collection('inboxes')
        .doc(localPart)
        .get();

      exists = snap.exists;
      attempts++;
    }

    if (exists) {
      throw new Error('Could not generate unique address');
    }

    const token = generateSecureToken();
    const tokenHash = hashToken(token);

    const expiresAt =
      Date.now() + expirationMinutes * 60 * 1000;

    await db.collection('inboxes').doc(localPart).set({
      localPart,
      email: `${localPart}@${domain}`,
      tokenHash,
      createdAt: Date.now(),
      expiresAt,
      messageCount: 0
    });

    return res.status(200).json({
      email: `${localPart}@${domain}`,
      token,
      expiresAt,
      expiresIn: expirationMinutes * 60
    });

  } catch (err) {
    console.error('Generate error:', err);

    return res.status(500).json({
      error: 'Failed to generate email',
      details: err.message || 'Unknown server error'
    });
  }
};
