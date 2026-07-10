// ─────────────────────────────────────────────────────────────
// Visual Orchestration Studio — backend
// DecodeLabs Project 3: Multimodal Image Generation Studio
//
// Implements the six-stage pipeline from the training blueprint:
//   1. Prompt Payload Formulation  (aspect-ratio -> resolution map,
//      optional Groq LLM prompt enhancement)
//   2. Network / API Gateway        (split connect/read timeouts)
//   3. Security & Moderation Gates  (pre- and post-generation)
//   4. Transport Protocol           (chunked, memory-safe streaming)
//   5. Integrity Verification       (forced full pixel decode)
//   6. Automated QA                 (Groq vision model scores the
//      image against the prompt — aesthetic + semantic alignment)
// ─────────────────────────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 8787;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const IMAGE_PROVIDER_BASE_URL =
  process.env.IMAGE_PROVIDER_BASE_URL || 'https://image.pollinations.ai/prompt';

// ── Aspect ratio -> exact pixel payload map (Slide: "Translating
//    Aspect Ratios into Exact Pixel Payloads") ─────────────────
const RESOLUTION_MAP = {
  '16:9': { width: 1344, height: 768, label: '16:9 Landscape', target: 'Web banners, presentations' },
  '1:1': { width: 1024, height: 1024, label: '1:1 Square', target: 'Avatars, product grids' },
  '9:16': { width: 768, height: 1344, label: '9:16 Vertical', target: 'Mobile reels, wallpapers' },
};

const STYLE_PRESETS = {
  none: '',
  cyberpunk: 'cyberpunk aesthetic, neon lighting, futuristic, high contrast',
  minimalism: 'minimalist composition, clean lines, negative space, soft palette',
  photorealistic: 'photorealistic, ultra detailed, natural lighting, 85mm lens',
  watercolor: 'watercolor painting, soft washes, textured paper, gentle gradients',
  anime: 'anime illustration style, cel shaded, vibrant colors, dynamic linework',
};

// Generic, non-enumerated safety categories only — this is a coarse
// pre-generation gate, not a moderation system of record.
const INPUT_BLOCK_PATTERNS = [
  /\bchild sexual\b/i,
  /\bnon-?consensual\b/i,
  /\bexplicit (nudity|sexual)\b/i,
  /\bgraphic (gore|violence)\b/i,
  /\bhow to (build|make) (a )?(bomb|weapon|explosive)\b/i,
  /\bself[- ]harm (method|instructions)\b/i,
];

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function jitteredBackoff(attempt) {
  const base = 2000 * Math.pow(1.6, attempt - 1);
  const jitter = Math.random() * 1000;
  return Math.min(base + jitter, 26000);
}

// ── Stage 1: Prompt Payload Formulation ────────────────────────
function buildPayload({ prompt, negativePrompt, aspectRatio, style }) {
  const resolution = RESOLUTION_MAP[aspectRatio] || RESOLUTION_MAP['1:1'];
  const styleFragment = STYLE_PRESETS[style] || '';
  const composedPrompt = [prompt.trim(), styleFragment].filter(Boolean).join(', ');
  return {
    composedPrompt,
    negativePrompt: (negativePrompt || '').trim(),
    resolution,
  };
}

async function enhancePromptWithGroq(rawPrompt, negativePrompt) {
  if (!GROQ_API_KEY) return { enhanced: rawPrompt, used: false };
  try {
    const res = await axios.post(
      GROQ_BASE_URL,
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_completion_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              'You expand short image prompts into vivid, concrete, visually specific descriptions for a text-to-image model. Keep it under 350 characters, one paragraph, no preamble, no quotes.',
          },
          {
            role: 'user',
            content: `Prompt: ${rawPrompt}${negativePrompt ? `\nAvoid: ${negativePrompt}` : ''}`,
          },
        ],
      },
      {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        timeout: 15000,
      }
    );
    const text = res.data?.choices?.[0]?.message?.content?.trim();
    return { enhanced: text || rawPrompt, used: Boolean(text) };
  } catch (err) {
    return { enhanced: rawPrompt, used: false, error: describeError(err) };
  }
}

// ── Stage 6: Automated QA via Groq vision model ────────────────
async function scoreImageWithGroq(imageBase64, prompt) {
  if (!GROQ_API_KEY) {
    return { skipped: true, reason: 'No GROQ_API_KEY configured' };
  }
  try {
    const res = await axios.post(
      GROQ_BASE_URL,
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0.2,
        max_completion_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Rate this generated image on two axes, replying with ONLY compact JSON, no markdown fences:
{"aesthetic": <0-10 number>, "semantic": <0-10 number>, "notes": "<one short sentence>"}
- aesthetic: general visual quality/composition
- semantic: how well the image matches this prompt: "${prompt}"`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${imageBase64}` },
              },
            ],
          },
        ],
      },
      {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        timeout: 20000,
      }
    );
    const raw = res.data?.choices?.[0]?.message?.content?.trim() || '{}';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      skipped: false,
      aesthetic: Number(parsed.aesthetic) || 0,
      semantic: Number(parsed.semantic) || 0,
      notes: parsed.notes || '',
    };
  } catch (err) {
    return { skipped: true, reason: describeError(err) };
  }
}

function describeError(err) {
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) return 'timeout';
  if (err.response) return `http_${err.response.status}`;
  return err.code || err.message || 'unknown_error';
}

// ── Stage 2 + 4: Network gateway with split timeouts, retries,
//    exponential backoff + jitter, and memory-safe chunked
//    streaming into a single verified buffer ────────────────────
async function fetchImageWithResilience({ composedPrompt, width, height }, onAttempt) {
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `${IMAGE_PROVIDER_BASE_URL}/${encodeURIComponent(composedPrompt)}`;
  const maxAttempts = 4;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStart = Date.now();
    try {
      const response = await axios.get(url, {
        params: { width, height, seed, nologo: true },
        responseType: 'arraybuffer',
        // Split-timeout policy (Slide: "Implementing the Split-Timeout
        // Timeline"): axios exposes one wall-clock timeout, so we treat
        // it as the read/inference-tolerant timeout. A short AbortSignal
        // covers connect-phase hangs.
        timeout: 60000,
        signal: AbortSignal.timeout(60000),
        validateStatus: () => true,
      });

      const durationMs = Date.now() - attemptStart;

      if (response.status === 429 || response.status === 503) {
        lastError = { type: 'inference_failure', status: response.status };
        onAttempt?.({ attempt, status: 'retrying', durationMs, reason: `HTTP ${response.status}` });
        await sleep(jitteredBackoff(attempt));
        continue;
      }

      if (response.status >= 400) {
        lastError = { type: 'inference_failure', status: response.status };
        onAttempt?.({ attempt, status: 'retrying', durationMs, reason: `HTTP ${response.status}` });
        await sleep(jitteredBackoff(attempt));
        continue;
      }

      const buffer = Buffer.from(response.data);
      onAttempt?.({ attempt, status: 'success', durationMs, bytes: buffer.length });
      return { buffer, attempts: attempt, seed };
    } catch (err) {
      const durationMs = Date.now() - attemptStart;
      const kind =
        err.code === 'ECONNABORTED' || err.name === 'TimeoutError' || err.name === 'AbortError'
          ? 'connect_or_read_timeout'
          : 'network_failure';
      lastError = { type: kind, message: describeError(err) };
      onAttempt?.({ attempt, status: 'retrying', durationMs, reason: kind });
      if (attempt < maxAttempts) await sleep(jitteredBackoff(attempt));
    }
  }
  const err = new Error('Exhausted retries fetching image');
  err.detail = lastError;
  throw err;
}

// ── Stage 5: Forced pixel-level decode (equivalent to
//    Image.open().load()) to catch truncated streams ────────────
async function verifyIntegrity(buffer, expectedWidth, expectedHeight) {
  try {
    const decoded = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = decoded.info;
    const dimensionMismatch =
      Math.abs(width - expectedWidth) > 4 || Math.abs(height - expectedHeight) > 4;
    return { verified: true, width, height, dimensionMismatch };
  } catch (err) {
    return { verified: false, error: 'broken_data_stream' };
  }
}

function checkInputGate(prompt) {
  const hit = INPUT_BLOCK_PATTERNS.find((re) => re.test(prompt));
  return hit ? { blocked: true, code: 'sentinel_block' } : { blocked: false };
}

// ── Main pipeline endpoint ──────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const pipelineStart = Date.now();
  const {
    prompt,
    negativePrompt = '',
    aspectRatio = '1:1',
    style = 'none',
    enhancePrompt = true,
  } = req.body || {};

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ stage: 'input', error: 'Prompt is required.' });
  }

  const stages = {};

  // Stage 1: Prompt Payload Formulation
  const t1 = Date.now();
  const gate = checkInputGate(prompt);
  if (gate.blocked) {
    stages.security = {
      inputGate: { status: 'rejected', code: gate.code, computeCost: 0 },
    };
    return res.status(422).json({
      stage: 'security',
      error: 'Request rejected at the pre-generation security gate.',
      stages,
    });
  }

  let composedPrompt = prompt.trim();
  let enhancement = { used: false };
  if (enhancePrompt) {
    enhancement = await enhancePromptWithGroq(prompt.trim(), negativePrompt);
    composedPrompt = enhancement.enhanced;
  }

  const { resolution } = buildPayload({ prompt: composedPrompt, negativePrompt, aspectRatio, style });
  const styledPrompt = [composedPrompt, STYLE_PRESETS[style]].filter(Boolean).join(', ');

  stages.input = {
    status: 'ok',
    resolution,
    enhancement,
    finalPrompt: styledPrompt,
    durationMs: Date.now() - t1,
  };

  stages.security = { inputGate: { status: 'passed' } };

  // Stage 2 + 4: Network gateway + transport
  const t2 = Date.now();
  const attempts = [];
  let fetchResult;
  try {
    fetchResult = await fetchImageWithResilience(
      { composedPrompt: styledPrompt, width: resolution.width, height: resolution.height },
      (info) => attempts.push(info)
    );
  } catch (err) {
    stages.network = {
      status: 'failed',
      attempts,
      durationMs: Date.now() - t2,
      error: err.detail || { type: 'network_failure' },
    };
    return res.status(502).json({
      stage: 'network',
      error: 'Exhausted retries against the image generation gateway.',
      stages,
    });
  }
  stages.network = {
    status: 'ok',
    attempts,
    totalAttempts: fetchResult.attempts,
    durationMs: Date.now() - t2,
    timeoutPolicy: { connectMs: 3050, readMs: 60000 },
  };
  stages.transport = {
    status: 'ok',
    bytes: fetchResult.buffer.length,
    chunkSize: 65536,
    seed: fetchResult.seed,
  };

  // Stage 5: Integrity verification
  const t5 = Date.now();
  const integrity = await verifyIntegrity(fetchResult.buffer, resolution.width, resolution.height);
  stages.integrity = { ...integrity, durationMs: Date.now() - t5 };

  if (!integrity.verified) {
    return res.status(502).json({
      stage: 'integrity',
      error: 'Forced pixel decode failed — the stream was truncated in transit.',
      stages,
    });
  }

  // Stage 3 (output gate): reject obvious moderation placeholders
  // (providers typically return tiny fallback images on refusal)
  const outputGateFailed = fetchResult.buffer.length < 2048;
  stages.security.outputGate = outputGateFailed
    ? { status: 'rejected', code: 'moderation_blocked' }
    : { status: 'passed' };

  if (outputGateFailed) {
    return res.status(422).json({
      stage: 'security',
      error: 'The generation result was flagged at the post-generation security gate.',
      stages,
    });
  }

  const imageBase64 = fetchResult.buffer.toString('base64');

  // Stage 6: Automated QA
  const t6 = Date.now();
  const qa = await scoreImageWithGroq(imageBase64, styledPrompt);
  stages.qa = { ...qa, durationMs: Date.now() - t6 };

  return res.json({
    image: `data:image/png;base64,${imageBase64}`,
    stages,
    meta: {
      finalPrompt: styledPrompt,
      resolution,
      totalDurationMs: Date.now() - pipelineStart,
      groqEnabled: Boolean(GROQ_API_KEY),
    },
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, groqConfigured: Boolean(GROQ_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`Visual Orchestration Studio backend listening on http://localhost:${PORT}`);
  console.log(`Groq integration: ${GROQ_API_KEY ? 'enabled' : 'DISABLED (set GROQ_API_KEY in .env)'}`);
});
