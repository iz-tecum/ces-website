// /api/contact.js (Vercel Serverless Function)
// No npm install needed — uses Resend HTTP API directly.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, email, subject, message, company } = req.body || {};

    // Honeypot (bots)
    if (typeof company === "string" && company.trim().length > 0) {
      return res.status(200).json({ ok: true });
    }

    // Basic validation
    const clean = (v) => (typeof v === "string" ? v.trim() : "");
    const n = clean(name);
    const e = clean(email);
    const s = clean(subject);
    const m = clean(message);

    if (!n || !e || !s || !m) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (n.length > 80 || e.length > 120 || s.length > 120 || m.length > 4000) {
      return res.status(400).json({ error: "Input too long." });
    }

    // Light email sanity check
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    if (!emailOk) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const TO = process.env.CONTACT_TO_EMAIL || "ilt2109@columbia.edu";
    const FROM = process.env.CONTACT_FROM_EMAIL || "CES Contact <onboarding@resend.dev>";
    const PREFIX = process.env.CONTACT_SUBJECT_PREFIX || "CES Website Contact";

    if (!RESEND_API_KEY) {
      return res.status(500).json({ error: "Server missing RESEND_API_KEY." });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="margin: 0 0 12px;">New CES Website Message</h2>
        <p style="margin: 0 0 10px;"><strong>Name:</strong> ${escapeHtml(n)}</p>
        <p style="margin: 0 0 10px;"><strong>Email:</strong> ${escapeHtml(e)}</p>
        <p style="margin: 0 0 10px;"><strong>Subject:</strong> ${escapeHtml(s)}</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 16px 0;" />
        <p style="white-space: pre-wrap; margin: 0;">${escapeHtml(m)}</p>
      </div>
    `;

    const text =
`New CES Website Message

Name: ${n}
Email: ${e}
Subject: ${s}

Message:
${m}
`;

    // Send via Resend Email API
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: `${PREFIX}: ${s}`,
        html,
        text,
        reply_to: e, // so replying goes to the person who filled the form
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return res.status(500).json({
        error: data?.message || data?.error || "Failed to send email.",
      });
    }

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error." });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
