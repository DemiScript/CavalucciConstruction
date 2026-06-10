import nodemailer from 'nodemailer';

// Gmail SMTP transporter. Credentials come exclusively from the environment;
// GMAIL_APP_PASSWORD must be a Gmail App Password, not the account password.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Fail fast / loud at startup if the credentials are missing or wrong.
transporter.verify((err) => {
  if (err) {
    console.error('SMTP transporter verification failed:', err.message);
  } else {
    console.log('SMTP transporter is ready to send messages.');
  }
});

// Escape user-supplied values before interpolating them into the HTML body.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendMail(fields) {
  const { name, phone, email, address, idea } = fields;
  const { line1, line2, city, state, zip } = address;

  // Drop empty line2 so it doesn't render as a blank address line.
  const addressLines = [line1, line2, `${city}, ${state} ${zip}`].filter(Boolean);

  const text = [
    `From:    ${name} <${email}>`,
    `Phone:   ${phone}`,
    '',
    'Address:',
    ...addressLines.map((line) => `  ${line}`),
    '',
    'Idea:',
    idea,
  ].join('\n');

  const html = `
    <table style="font-family: Arial, sans-serif; font-size: 14px; border-collapse: collapse;">
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">From</td><td>${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Phone</td><td>${escapeHtml(phone)}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold; vertical-align: top;">Address</td><td>${addressLines.map(escapeHtml).join('<br>')}</td></tr>
      <tr><td style="padding: 4px 12px 4px 0; font-weight: bold; vertical-align: top;">Idea</td><td><pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${escapeHtml(idea)}</pre></td></tr>
    </table>
  `.trim();

  const mailOptions = {
    from: `"Contact Form" <${process.env.GMAIL_USER}>`,
    to: process.env.RECIPIENT_EMAIL,
    replyTo: email,
    subject: `New Contact Form Submission from ${name}`,
    text,
    html,
  };

  return transporter.sendMail(mailOptions);
}

export default sendMail;
