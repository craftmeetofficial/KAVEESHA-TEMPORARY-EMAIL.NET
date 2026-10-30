const formData = require('form-data');
const Mailgun = require('mailgun.js');

function getMailgun() {
  const mailgun = new Mailgun(formData);
  return mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY
  });
}

function verifyMailgunSignature(timestamp, token, signature) {
  const crypto = require('crypto');
  const encoded = crypto
    .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
  return encoded === signature;
}

module.exports = { getMailgun, verifyMailgunSignature };