const API_BASE = window.location.origin.includes('5500') || window.location.protocol === 'file:'
  ? 'http://localhost:8787'
  : ''; // same-origin when served by the Express server itself

const state = {
  aspectRatio: '1:1',
  style: 'none',
};

// ── Element refs ───────────────────────────────────────────
const promptEl = document.getElementById('prompt');
const negativePromptEl = document.getElementById('negativePrompt');
const enhanceToggle = document.getElementById('enhanceToggle');
const generateBtn = document.getElementById('generateBtn');
const formHint = document.getElementById('formHint');

const resultEmpty = document.getElementById('resultEmpty');
const resultContent = document.getElementById('resultContent');
const resultError = document.getElementById('resultError');
const resultImage = document.getElementById('resultImage');

const groqDot = document.getElementById('groqDot');
const groqStatusText = document.getElementById('groqStatusText');

// ── Ratio / style pickers ──────────────────────────────────
document.getElementById('ratioPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.ratio-btn');
  if (!btn) return;
  document.querySelectorAll('.ratio-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.aspectRatio = btn.dataset.ratio;
});

document.getElementById('stylePicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('.chip').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.style = btn.dataset.style;
});

// ── Groq health check ──────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    if (data.groqConfigured) {
      groqDot.className = 'dot on';
      groqStatusText.textContent = 'Groq connected';
    } else {
      groqDot.className = 'dot off';
      groqStatusText.textContent = 'Groq key missing — set GROQ_API_KEY';
    }
  } catch {
    groqDot.className = 'dot off';
    groqStatusText.textContent = 'Backend unreachable';
  }
}
checkHealth();

// ── Pipeline stage animation helpers ────────────────────────
const STAGE_ORDER = ['input', 'network', 'security', 'transport', 'integrity', 'qa'];

function resetPipeline() {
  STAGE_ORDER.forEach((name) => {
    const li = document.querySelector(`.stage[data-stage="${name}"]`);
    li.classList.remove('active', 'success', 'error');
    li.querySelector('.stage-state').textContent = 'idle';
  });
}

function setStage(name, status) {
  const li = document.querySelector(`.stage[data-stage="${name}"]`);
  if (!li) return;
  li.classList.remove('active', 'success', 'error');
  li.classList.add(status);
  const labelMap = { active: 'running', success: 'ok', error: 'failed' };
  li.querySelector('.stage-state').textContent = labelMap[status] || status;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Reveal the returned stage results one-by-one, on top of whatever
// really happened server-side, for a legible pipeline animation.
async function animateStages(stagesResult, failedAt) {
  for (const name of STAGE_ORDER) {
    setStage(name, 'active');
    await wait(280);
    if (failedAt === name) {
      setStage(name, 'error');
      return;
    }
    const present = stagesResult[name];
    if (!present && name === 'qa') {
      // qa may be entirely absent on early failure; otherwise fine
      setStage(name, 'success');
      continue;
    }
    setStage(name, 'success');
  }
}

// ── Generate ─────────────────────────────────────────────────
generateBtn.addEventListener('click', async () => {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    formHint.textContent = 'Enter a prompt before deploying the payload.';
    promptEl.focus();
    return;
  }

  generateBtn.disabled = true;
  formHint.textContent = 'Serializing multimodal payload and dispatching to the gateway…';
  resultEmpty.hidden = true;
  resultContent.hidden = true;
  resultError.hidden = true;
  resetPipeline();

  const body = {
    prompt,
    negativePrompt: negativePromptEl.value.trim(),
    aspectRatio: state.aspectRatio,
    style: state.style,
    enhancePrompt: enhanceToggle.checked,
  };

  try {
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      await animateStages(data.stages || {}, data.stage);
      showError(data);
      return;
    }

    await animateStages(data.stages, null);
    showResult(data);
    formHint.textContent = 'Pipeline complete.';
  } catch (err) {
    resetPipeline();
    setStage('input', 'success');
    setStage('network', 'error');
    showError({
      stage: 'network',
      error: 'Could not reach the backend. Is the server running on port 8787?',
      stages: {},
    });
  } finally {
    generateBtn.disabled = false;
  }
});

function showResult(data) {
  resultContent.hidden = false;
  resultImage.src = data.image;

  document.getElementById('metaResolution').textContent =
    `${data.meta.resolution.width}×${data.meta.resolution.height} (${data.meta.resolution.label})`;
  document.getElementById('metaAttempts').textContent =
    `${data.stages.network.totalAttempts} of 4 max`;
  document.getElementById('metaTime').textContent = `${data.meta.totalDurationMs} ms`;
  document.getElementById('metaPrompt').textContent = data.meta.finalPrompt;

  const qa = data.stages.qa;
  const qaScores = document.getElementById('qaScores');
  if (qa && !qa.skipped) {
    qaScores.hidden = false;
    const aFill = document.getElementById('aestheticFill');
    const sFill = document.getElementById('semanticFill');
    aFill.style.width = `${qa.aesthetic * 10}%`;
    sFill.style.width = `${qa.semantic * 10}%`;
    document.getElementById('aestheticValue').textContent = `${qa.aesthetic.toFixed(1)} / 10`;
    document.getElementById('semanticValue').textContent = `${qa.semantic.toFixed(1)} / 10`;
    document.getElementById('qaNotes').textContent = qa.notes || '';
  } else {
    qaScores.hidden = false;
    document.getElementById('aestheticValue').textContent = '—';
    document.getElementById('semanticValue').textContent = '—';
    document.getElementById('aestheticFill').style.width = '0%';
    document.getElementById('semanticFill').style.width = '0%';
    document.getElementById('qaNotes').textContent =
      qa?.reason || 'QA skipped — set GROQ_API_KEY to enable aesthetic + semantic scoring.';
  }

  document.getElementById('downloadBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = data.image;
    a.download = `generated-${Date.now()}.png`;
    a.click();
  };
}

function showError(data) {
  resultError.hidden = false;
  document.getElementById('errorStageBadge').textContent = `STAGE: ${(data.stage || 'unknown').toUpperCase()}`;
  document.getElementById('errorMessage').textContent = data.error || 'Pipeline failed.';

  const matrix = document.getElementById('exceptionMatrix');
  matrix.innerHTML = '';

  const cards = [];
  if (data.stage === 'network') {
    cards.push(
      { title: 'Network failure', body: 'ConnectTimeout — client could not establish a TCP connection. Fail fast, do not wait.' },
      { title: 'Inference failure', body: 'ReadTimeout — connection succeeded but the GPU cluster took too long to respond.' }
    );
  } else if (data.stage === 'security') {
    cards.push(
      { title: 'Input gate', body: 'sentinel_block / content_policy_violation — rejected pre-generation, 0 compute cost.' },
      { title: 'Output gate', body: 'moderation_blocked — flagged post-generation, compute cost fully incurred.' }
    );
  } else if (data.stage === 'integrity') {
    cards.push(
      { title: 'Truncated stream', body: 'OSError: broken data stream — Image.load() forced a full pixel decode and caught a mid-download drop.' }
    );
  } else {
    cards.push({ title: 'Unhandled', body: data.error || 'See server logs for details.' });
  }

  for (const c of cards) {
    const div = document.createElement('div');
    div.className = 'exception-card';
    div.innerHTML = `<b>${c.title}</b>${c.body}`;
    matrix.appendChild(div);
  }

  formHint.textContent = 'Pipeline halted — see exception matrix below.';
}
