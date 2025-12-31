// api/contact.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function clean(s = "") {
  return String(s).trim();
}

function isEmail(s = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const body = req.body || {};
    const company = clean(body.company); // honeypot

    // Honeypot: if filled, pretend success
    if (company.length) {
      return res.status(200).json({ ok: true });
    }

    const name = clean(body.name);
    const email = clean(body.email);
    const subject = clean(body.subject);
    const message = clean(body.message);

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ ok: false, error: "Missing required fields." });
    }
    if (name.length > 80) return res.status(400).json({ ok: false, error: "Name too long." });
    if (email.length > 120 || !isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email." });
    }
    if (subject.length > 120) return res.status(400).json({ ok: false, error: "Subject too long." });
    if (message.length > 4000) return res.status(400).json({ ok: false, error: "Message too long." });

    const to = process.env.CONTACT_TO;
    const from = process.env.CONTACT_FROM || "CES Website <onboarding@resend.dev>";

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: "Server not configured (missing RESEND_API_KEY)." });
    }
    if (!to) {
      return res.status(500).json({ ok: false, error: "Server not configured (missing CONTACT_TO)." });
    }

    const safeSubject = `[CES Contact] ${subject}`;

    await resend.emails.send({
      from,
      to,
      replyTo: email, // so board can reply directly to sender
      subject: safeSubject,
      text:
`New message from CES website:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to send." });
  }
}