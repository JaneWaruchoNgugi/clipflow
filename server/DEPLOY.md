# Deploy ClipFlow on Firebase (from your phone)

This puts two things in your Firebase project:

1. **The app** on Firebase Hosting, at `https://clipflow-e1d70.web.app`
2. **The download server** on Cloud Run (part of the same Google Cloud project), which fetches YouTube, TikTok and Instagram videos for the app

Everything below can be done in your phone's browser. It takes about 15 minutes.

> Only download videos you own or have permission to use.

## What you need

- Your Firebase project: **`clipflow-e1d70`** (already filled in below). The web app config (apiKey and so on) isn't needed.
- The **Blaze (pay as you go) plan** on that project. Cloud Run needs it. Personal use usually stays inside Google's free monthly allowance, but set a budget alert so you're never surprised:
  Firebase console → **Usage and billing** → **Details & settings** → **Modify plan** → Blaze, then add a budget (for example $5).

## 1. Open Cloud Shell

Open <https://shell.cloud.google.com/?show=terminal> and sign in with the same Google account as Firebase. You get a terminal in the browser. Paste each block below and press Enter.

```bash
gcloud config set project clipflow-e1d70
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
git clone https://github.com/JaneWaruchoNgugi/clipflow && cd clipflow
```

## 2. Deploy the download server

This makes a random access key so only you can use your server. **Copy the key it prints** and keep it somewhere safe.

```bash
PROJECT=$(gcloud config get-value project)
KEY=$(openssl rand -hex 16); echo "Your access key: $KEY"
gcloud run deploy clipflow-api --source server --region us-central1 \
  --allow-unauthenticated --memory 1Gi --cpu 1 --timeout 900 \
  --concurrency 4 --max-instances 2 \
  --set-env-vars "ACCESS_KEY=$KEY"
```

If it asks to create an Artifact Registry repository, answer `Y`. When it finishes it prints a **Service URL**. It should be `https://clipflow-api-212955757755.us-central1.run.app`, which the app already uses by default. If yours is different, you'll paste it into the app in step 4.

("allow-unauthenticated" just means the app can reach it; the access key is what keeps strangers out.)

## 3. Deploy the app

```bash
API=$(gcloud run services describe clipflow-api --region us-central1 --format 'value(status.url)')
npm ci
VITE_API_URL=$API npm run build
npx firebase-tools login --no-localhost
npx firebase-tools deploy --only hosting --project "$PROJECT"
```

The login step shows a link: open it, sign in, and paste the code back into Cloud Shell.

## 4. Connect the app to your server

1. Open `https://clipflow-e1d70.web.app` on your phone (your Vercel address works too).
2. Tap **Set up the download server**. The address is already filled in; paste your **access key** and tap **Save & test**.
3. Paste a YouTube, TikTok or Instagram link and tap **Get video**. Then choose **Save** or **Edit**.

Tip: in Chrome, open the menu and tap **Add to Home screen** to launch ClipFlow like an app.

## Updating later

In Cloud Shell, `cd clipflow && git pull`, then run step 2 again (it reuses the same address; the access key changes, so either re-enter it in the app or replace `KEY=$(openssl rand -hex 16)` with `KEY=your-old-key`) and step 3.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| "Wrong or missing access key" | Re-enter the key in the app's server settings. |
| "…asked the server to sign in…" | The video is private or age-restricted, or the site is limiting cloud servers. YouTube does this most. See *Cookies* below. |
| "Can't reach your download server" | Check the address in the app's server settings, and that step 2 finished without errors. |
| "The server is busy" | Wait for the other download to finish. |

### Cookies (optional, for YouTube "sign in" errors)

Sites sometimes block cloud servers unless they look signed in. You can give the server cookies from a **spare** account, exported as `cookies.txt`, stored as a secret:

```bash
gcloud secrets create clipflow-cookies --data-file=cookies.txt
gcloud run services update clipflow-api --region us-central1 \
  --set-secrets=/secrets/cookies.txt=clipflow-cookies:latest \
  --update-env-vars COOKIES_FILE=/secrets/cookies.txt
```

Use a spare account: sites can restrict accounts used this way.

## Server settings

Set with `--update-env-vars NAME=value` on `gcloud run services update clipflow-api --region us-central1`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ACCESS_KEY` | none | Required key for every request (set in step 2). |
| `ALLOWED_ORIGINS` | `*` | Web addresses allowed to call the server (the access key already keeps strangers out; narrow this if you like, e.g. `https://clipflow-e1d70.web.app`). |
| `MAX_DURATION` | `900` | Longest video in seconds. |
| `MAX_HEIGHT` | `1080` | Highest resolution fetched. |
| `MAX_FILESIZE_MB` | `400` | Largest file. |
| `MAX_CONCURRENT` | `2` | Downloads at the same time. |
| `COOKIES_FILE` | none | Path to a cookies.txt secret. |
