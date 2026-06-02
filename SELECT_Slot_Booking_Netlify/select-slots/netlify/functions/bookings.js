import { getStore } from "@netlify/blobs";
import nodemailer from "nodemailer";

const DAY_LABELS = {
  "2026-06-12": "Friday 12 June",
  "2026-06-15": "Monday 15 June",
  "2026-06-16": "Tuesday 16 June"
};
const TIME_LABELS = {
  "09": "9:00 – 10:00",
  "10": "10:00 – 11:00",
  "11": "11:00 – 12:00",
  "12": "12:00 – 13:00",
  "13": "13:00 – 14:00",
  "14": "14:00 – 15:00"
};

function slotLabel(slot) {
  const [d, t] = slot.split("_");
  return (DAY_LABELS[d] || d) + ", " + (TIME_LABELS[t] || t);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async (req) => {
  // Strong consistency so a booking is visible immediately to everyone else.
  const store = getStore({ name: "select-slot-bookings", consistency: "strong" });

  // ---- list current bookings (names only, no emails exposed to clients) ----
  if (req.method === "GET") {
    const out = {};
    const { blobs } = await store.list();
    for (const b of blobs) {
      const rec = await store.get(b.key, { type: "json" });
      if (rec) out[b.key] = { name: rec.name, bookedAt: rec.bookedAt };
    }
    return json(out);
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad-request" }, 400); }

    // ---- admin: clear everything ----
    if (body.action === "clear") {
      if (!process.env.ADMIN_CODE || body.code !== process.env.ADMIN_CODE) {
        return json({ error: "unauthorised" }, 401);
      }
      const { blobs } = await store.list();
      for (const b of blobs) await store.delete(b.key);
      return json({ ok: true });
    }

    // ---- book a slot ----
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const slot = (body.slot || "").trim();
    const [d, t] = slot.split("_");

    if (!name || !email || !slot) return json({ error: "missing" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email" }, 400);
    if (!DAY_LABELS[d] || !TIME_LABELS[t]) return json({ error: "slot" }, 400);

    // Fast check for the common case.
    const existing = await store.get(slot, { type: "json" });
    if (existing) return json({ error: "taken" }, 409);

    // Atomic guard against two people grabbing the same slot at once:
    // onlyIfNew means the write succeeds only if the slot does not already exist.
    const record = { name, email, bookedAt: new Date().toISOString() };
    const result = await store.setJSON(slot, record, { onlyIfNew: true });
    if (result && result.modified === false) return json({ error: "taken" }, 409);

    // Email both parties. Never fail the booking if email has a hiccup.
    try { await sendEmails(name, email, slot); }
    catch (e) { console.error("Email send failed:", e); }

    return json({ ok: true, slot });
  }

  return json({ error: "method-not-allowed" }, 405);
};

async function sendEmails(name, email, slot) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) { console.warn("Email not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing)."); return; }

  const when = slotLabel(slot);
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  // To the client
  await transporter.sendMail({
    from: `"SELECT Programme" <${user}>`,
    to: email,
    subject: `Your SELECT consulting slot — ${when}`,
    text:
`Hi ${name},

Your one-hour SELECT consulting slot is confirmed:

  ${when}

This session is to set the scene on the next work piece. Meeting details will follow separately.

See you then,
Fiona
SELECT Programme`
  });

  // To Fiona
  await transporter.sendMail({
    from: `"SELECT Booking" <${user}>`,
    to: user,
    replyTo: email,
    subject: `SELECT slot booked — ${name} — ${when}`,
    text:
`${name} (${email}) has booked a consulting slot:

  ${when}

Booked at ${new Date().toISOString()}.`
  });
}
