<div align="center">

# 🎨 Visual Orchestration Studio

**A Fault-Tolerant Multimodal Image Generation Pipeline**

*DecodeLabs · Generative AI Industrial Training — Project 3*

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Groq](https://img.shields.io/badge/Powered%20by-Groq-F55036?style=for-the-badge)](https://groq.com)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](#-license)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)](#)
[![Made with DecodeLabs](https://img.shields.io/badge/Made%20with-DecodeLabs-8A2BE2?style=flat-square)](https://decodelabs.tech)

*A production-styled text-to-image application with a dark, engineering-blueprint
UI — built around a six-stage, fault-tolerant generation architecture instead of
a single API call.*

<br/>

[Overview](#-overview) •
[Features](#-features) •
[Getting Started](#-getting-started) •
[Usage](#-usage) •
[Tech Stack](#️-tech-stack) •
[Roadmap](#️-roadmap)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Why This Project Matters](#-why-this-project-matters)
- [Architecture](#️-architecture)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Getting Started](#-getting-started)
- [Usage](#️-usage)
- [Project Structure](#-project-structure)
- [Extending: Swapping the Image Engine](#-extending-swapping-the-image-engine)
- [Tech Stack](#️-tech-stack)
- [Roadmap](#️-roadmap)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Author](#-author)

---

## 🧭 Overview

Most text-to-image demos stop at *"call the API, show the picture."* This
project is built the other way around: it treats image generation as a
**distributed systems problem** — one with network timeouts, transient
failures, corrupted binary streams, and content policy gates — and makes
every stage of that pipeline **visible and observable** in the UI itself.

## 💡 Why This Project Matters

Generative AI engineering isn't just prompt-writing — it's building the
infrastructure that makes a generative feature *reliable*. This project
demonstrates:

- Designing resilient network calls around unreliable third-party inference APIs
- Preventing silent data corruption in binary transport
- Layering safety gates without wasting compute on doomed requests
- Building automated, model-based quality assurance instead of manual review

<div align="right"><a href="#-table-of-contents">⬆ Back to top</a></div>

## 🏗️ Architecture

<div align="center">

| | | | | | |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **1️⃣ Prompt Payload** | ➜ | **2️⃣ Network Gateway** | ➜ | **3️⃣ Security Gates** |
| ➜ **4️⃣ Transport Protocol** | ➜ | **5️⃣ Integrity Verify** | ➜ | **6️⃣ Automated QA** |

</div>

| Stage | Responsibility |
|---|---|
| **1. Prompt Payload Formulation** | Maps the selected aspect ratio to an exact pixel resolution; optionally rewrites the prompt into a richer one using a Groq LLM. |
| **2. Network / API Gateway** | Split connect/read timeout policy with exponential backoff and jitter on retry. |
| **3. Security & Moderation Gates** | Pre-generation input gate (zero compute cost on rejection) and a post-generation output gate. |
| **4. Transport Protocol** | Memory-safe, chunked binary transfer of the generated image. |
| **5. Integrity Verification** | Forces a full pixel-level decode so a truncated network stream is caught rather than silently saved. |
| **6. Automated QA** | A Groq vision model scores the image on aesthetic quality and semantic alignment with the original prompt. |

<div align="center">

**Image generation:** [Pollinations.ai](https://pollinations.ai) — no API key required
**Prompt enhancement & QA scoring:** [Groq](https://groq.com) — the only API key this project needs

</div>

<div align="right"><a href="#-table-of-contents">⬆ Back to top</a></div>

## ✨ Features

<div align="center">

| | | |
|---|---|---|
| 🎛️ **Live pipeline visualization** | 📐 **Precise aspect-ratio control** | 🎨 **Style presets** |
| 🧠 **LLM prompt enhancement** | 🛡️ **Dual-gate content safety** | 🔁 **Resilient networking** |
| 🔍 **Corruption-proof downloads** | 📊 **Automated QA scoring** | 🌓 **First-class dark UI** |

</div>

<div align="right"><a href="#-table-of-contents">⬆ Back to top</a></div>

## 📸 Screenshots

<div align="center">

| <img width="745" height="237" alt="Screenshot 2026-07-10 162814" src="https://github.com/user-attachments/assets/a84936c8-338a-425d-8cdb-7089f93963c5" />
 | <img width="567" height="100" alt="Screenshot 2026-07-10 164755" src="https://github.com/user-attachments/assets/02922816-2aba-41b4-b985-d0274d57dce1" />
 |<img width="733" height="228" alt="Screenshot 2026-07-10 164715" src="https://github.com/user-attachments/assets/434d29be-ce09-410d-90f2-ea03c85cd158" />


</div>

<div align="right"><a href="#-table-of-contents">⬆ Back to top</a></div>

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) v18 or later
- A free [Groq API key](https://console.groq.com/keys) 

### 1. Clone the repository
```bash
git clone https://github.com/Imtishal-Abid/visual-orchestration-studio-.git
cd visual-orchestration-studio-/server
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and add your Groq key:
```env
GROQ_API_KEY=your_key_here
```
> 💡 The app runs fully without a Groq key — prompt enhancement and QA scoring
> are simply skipped, and image generation still works end to end.

### 3. Install dependencies
```bash
npm install
```

### 4. Run the app
```bash
npm start
```
Open **http://localhost:8787** — a single Express server serves both the
frontend and the API.

<div align="right"><a href="#-table-of-contents">⬆ Back to top</a></div>

## 🖱️ Usage

1. Enter a prompt (and optionally a negative prompt).
2. Choose an aspect ratio — `16:9`, `1:1`, or `9:16`.
3. Select a style preset.
4. Toggle Groq prompt enhancement on or off.
5. Click **Deploy Payload** and watch the six pipeline stages execute in real time.
6. Download the result as a PNG.

If any stage fails — a blocked prompt, a network timeout, a truncated stream —
the UI surfaces an exception-matrix panel describing exactly what happened and why.

## 📁 Project Structure
visual-orchestration-studio/
├── server/
│   ├── server.js         # Express backend — the full generation pipeline
│   ├── package.json
│   └── .env.example      # Copy to .env and add GROQ_API_KEY
└── public/
├── index.html
├── styles.css
└── app.js
## 🔌 Extending: Swapping the Image Engine

The image request lives in `fetchImageWithResilience()` inside `server.js`,
which targets `IMAGE_PROVIDER_BASE_URL`. To integrate DALL·E 3, Stable Image
Core, or another provider, swap the request inside that function for the new
provider's API/SDK call, keeping the same retry, timeout, and streaming
structure around it.

<div align="right"><a href="#-table-of-contents">⬆ Back to top</a></div>

## 🛠️ Tech Stack

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?style=for-the-badge)
![Sharp](https://img.shields.io/badge/Sharp-99CC00?style=for-the-badge)

</div>

<div align="right"><a href="#-table-of-contents">⬆ Back to top</a></div>

## 🗺️ Roadmap

- [ ] Add support for multiple image providers (DALL·E 3, Stable Diffusion)
- [ ] Persist generation history
- [ ] Batch generation mode
- [ ] User authentication for saved galleries

## 📄 License

This project was built as part of the **DecodeLabs Generative AI Industrial
Training Program** and is shared for educational and portfolio purposes.

## 🙏 Acknowledgments

- **[DecodeLabs](https://decodelabs.tech)** — for the training curriculum and project blueprint
- **[Groq](https://groq.com)** — for fast LLM and vision model inference
- **[Pollinations.ai](https://pollinations.ai)** — for free, key-less image generation

## 👤 Author

<div align="center">

**Imtishal Abid**

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Imtishal-Abid)

</div>

---

<div align="center">

**Built with DecodeLabs · Generative AI Industrial Training Kit**

⭐ If you found this project useful, consider giving it a star!

</div>
