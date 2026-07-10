# Visual Orchestration Studio
### DecodeLabs · Generative AI Project 3 — Multimodal Image Generation Studio

A production-styled text-to-image pipeline with a first-class dark "blueprint" UI,
built around the six-stage architecture from the training deck:

1. **Prompt Payload Formulation** — maps aspect ratio to an exact resolution, and
   optionally rewrites your prompt into a richer one with a Groq LLM.
2. **Network / API Gateway** — split-timeout policy with exponential backoff + jitter.
3. **Security & Moderation Gates** — a pre-generation input gate (0 compute cost on
   rejection) and a post-generation output gate.
4. **Transport Protocol** — memory-safe, chunked binary transfer.
5. **Integrity Verification** — forces a full pixel-level decode so a truncated
   stream is caught instead of silently saved.
6. **Automated QA** — a Groq vision model rates the image on aesthetic quality and
   how well it matches your prompt (semantic alignment).

Image generation itself uses **Pollinations.ai**, which needs no API key. **Groq**
powers prompt enhancement and the QA scoring step — that's the only key you need.

---

## 1. Get a Groq API key

Create a free key at **https://console.groq.com/keys**.

## 2. Configure the backend

```bash
cd server
cp .env.example .env
# open .env and paste your key into GROQ_API_KEY=
```

The app runs fine with `GROQ_API_KEY` left blank — prompt enhancement and QA
scoring are simply skipped, and image generation still works.

## 3. Install and run

```bash
cd server
npm install
npm start
```

Then open **http://localhost:8787** — the same Express server serves the frontend
and the API, so there's nothing else to start.

## 4. Using it

- Write a prompt, optionally a negative prompt.
- Pick an aspect ratio (16:9 / 1:1 / 9:16) and a style preset.
- Toggle "Enhance prompt with Groq" on/off.
- Click **Deploy Payload** and watch the six pipeline stages light up as they run.
- Download the result as a PNG once it lands.

If a stage fails (blocked prompt, network timeout, truncated stream), the UI shows
an exception-matrix panel explaining what happened, mirroring the failure modes
in the training material.

## Project layout

```
image-studio/
├── server/
│   ├── server.js        # Express backend, the whole pipeline
│   ├── package.json
│   └── .env.example      # copy to .env and add GROQ_API_KEY
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

## Swapping in a different image engine

`server.js` → `fetchImageWithResilience()` builds the request to
`IMAGE_PROVIDER_BASE_URL`. To use DALL·E 3, Stable Image Core, or another
provider instead, replace that function's request with the provider's SDK/API
call and keep the same retry/timeout/streaming shape around it.
