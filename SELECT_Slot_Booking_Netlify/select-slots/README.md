# SELECT — Consulting Slot Booking (Netlify)

A tiny booking page for 5 clients to pick a 1-hour slot across
Fri 12, Mon 15 and Tue 16 June (9am–3pm). When a slot is taken it
locks and turns red for everyone, and a confirmation email is sent
to both the client and you.

No external database — bookings live in Netlify Blobs (built in).
Emails are sent from your Gmail via an app password.

## Deploy

**Option A — drag and drop (quickest)**
1. Unzip this folder.
2. Go to Netlify → Add new site → Deploy manually.
3. Drag the unzipped `select-slots` folder onto the page.

**Option B — GitHub (matches your other sites)**
1. Push this folder to a new repo.
2. Netlify → Add new site → Import from Git → pick the repo.
3. Leave build command blank; publish directory `.`.

## Set three environment variables

Site → Site configuration → Environment variables → Add:

| Key                  | Value                                                  |
|----------------------|--------------------------------------------------------|
| GMAIL_USER           | fionadescoteaux@gmail.com                               |
| GMAIL_APP_PASSWORD   | a 16-character Gmail app password (see below)           |
| ADMIN_CODE           | any code you choose — needed for the "Clear all" button |

After adding them, trigger one redeploy so the function picks them up.

### Getting a Gmail app password
1. Google Account → Security → turn on 2-Step Verification (if not already).
2. Security → App passwords → create one (name it "SELECT booking").
3. Copy the 16 characters (no spaces) into GMAIL_APP_PASSWORD.

## Use
Send the site URL to your 5 clients. They enter name + email, tap
**Refresh availability**, then pick a slot. Done.

To reset before or after the round, click "Clear all bookings" at the
bottom and enter your ADMIN_CODE.

## Changing dates or times later
Edit the `DAYS` / `TIMES` lists in **both** `index.html` and
`netlify/functions/bookings.js` (they must match), then redeploy.
