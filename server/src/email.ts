// Outgoing email, sent through the Resend API (https://resend.com/docs/api-reference/emails/send-email).
//
// Configure with environment variables (see server/.env.example):
//   RESEND_API_KEY  required to actually send; without it emails are printed to the console
//   EMAIL_FROM      sender, e.g. "LittleRoots <hello@little-roots.app>" (domain verified in Resend)

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Something that delivers an email. Swappable so tests can capture emails instead of sending them. */
export type EmailTransport = (email: Email) => Promise<void>;

const DEFAULT_FROM = 'LittleRoots <hello@little-roots.app>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const resendTransport: EmailTransport = async (email) => {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!response.ok) {
    // Resend explains the problem in the body (bad key, unverified domain, ...).
    throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`);
  }
};

// Lets teammates without an API key still try the flow: the link shows up in the server log.
const consoleTransport: EmailTransport = async (email) => {
  console.log(`\n[email] RESEND_API_KEY is not set, so this email was not sent.\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
};

let transport: EmailTransport | null = null;

/** For tests: replace how emails are delivered. Pass null to go back to the default. */
export function setEmailTransport(next: EmailTransport | null): void {
  transport = next;
}

export function sendEmail(email: Email): Promise<void> {
  const deliver = transport ?? (process.env.RESEND_API_KEY ? resendTransport : consoleTransport);
  return deliver(email);
}

/** Base URL of the web app, used to build links in emails. */
export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
}

// ---- Templates ----

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Simple, email-client-safe layout in the LittleRoots colors. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#fafdf5;font-family:Arial,Helvetica,sans-serif;color:#585858;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border-top:6px solid #d2eaab;">
          <tr><td style="padding:32px 28px;">
            <p style="margin:0 0 20px;font-size:20px;font-weight:bold;"><span style="color:#7c9753;">Little</span><span style="color:#8a4b25;">Roots</span></p>
            <h1 style="margin:0 0 16px;font-size:20px;color:#111111;">${escapeHtml(title)}</h1>
            ${bodyHtml}
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#8a93a6;">LittleRoots · Beautiful names, bright futures</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function passwordResetEmail(to: string, name: string, resetLink: string, expiresInMinutes: number): Email {
  const safeLink = escapeHtml(resetLink);
  return {
    to,
    subject: 'Reset your LittleRoots password',
    html: layout(
      'Reset your password',
      `<p style="margin:0 0 16px;line-height:1.5;">Hi ${escapeHtml(name)}, we received a request to reset the password for your LittleRoots account.</p>
       <p style="margin:0 0 24px;">
         <a href="${safeLink}" style="display:inline-block;padding:12px 24px;background:#d2eaab;color:#3d4a2c;font-weight:bold;text-decoration:none;border-radius:6px;">Choose a new password</a>
       </p>
       <p style="margin:0 0 12px;font-size:13px;line-height:1.5;">This link expires in ${expiresInMinutes} minutes and can only be used once. If the button doesn't work, copy this address into your browser:<br><a href="${safeLink}" style="color:#2f6fde;word-break:break-all;">${safeLink}</a></p>
       <p style="margin:0;font-size:13px;line-height:1.5;">If you didn't ask to reset your password, you can ignore this email. Your password won't change.</p>`,
    ),
    text: `Hi ${name},

We received a request to reset the password for your LittleRoots account.
Choose a new password here (expires in ${expiresInMinutes} minutes, works once):

${resetLink}

If you didn't ask to reset your password, you can ignore this email.`,
  };
}

export function passwordChangedEmail(to: string, name: string): Email {
  const resetLink = `${appUrl()}/forgot-password`;
  return {
    to,
    subject: 'Your LittleRoots password was changed',
    html: layout(
      'Your password was changed',
      `<p style="margin:0 0 16px;line-height:1.5;">Hi ${escapeHtml(name)}, the password for your LittleRoots account was just changed, and you were signed out on your other devices.</p>
       <p style="margin:0;font-size:13px;line-height:1.5;">If this wasn't you, <a href="${escapeHtml(resetLink)}" style="color:#2f6fde;">reset your password</a> right away.</p>`,
    ),
    text: `Hi ${name},

The password for your LittleRoots account was just changed, and you were signed out on your other devices.

If this wasn't you, reset your password right away: ${resetLink}`,
  };
}
