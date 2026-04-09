# BuildMyResume 🚀

BuildMyResume is an advanced, AI-powered platform designed to automatically extract data from resumes, generate highly tailored professional content, and instantly deploy personalized, sleek portfolio websites with zero configuration required.

## 🏗️ Monorepo Architecture

This repository is structured as a monorepo containing two decoupled, highly optimized systems:

1. **/frontend:** A lightning-fast, client-side SPA (Single Page Application) built with **React**, **Vite**, **TypeScript**, and **Tailwind CSS**.
2. **/backend:** A robust, memory-safe API built with **Node.js**, **Express 5**, and **MongoDB**.

---

## 🎯 Global Features & Workflows

### 🏎️ High-Speed AI Integration
Instead of relying on standard OpenAI models, we utilize the **Groq SDK via Langchain**. Groq runs on specialized LPUs (Language Processing Units) which generate tokens exponentially faster than standard GPUs. This guarantees that when a user requests "AI-tailoring" of their resume bullets, the interface remains exceptionally fluid and responsive in real-time.

### 🛡️ Ironclad Backend Memory Protection
A unique challenge of this application is handling heavily resource-intensive computational tasks in a Node.js runtime:
- **Optical Character Recognition (OCR)** via `tesseract.js` for images.
- **Binary Parsing** via `pdf-parse` and `mammoth` for DOCX files.
- **Dynamic Vite Compilation** running `npm install` and `npm run build` during Portfolio Publishing.

To prevent Out-of-Memory (OOM) crashes on low-tier cloud instances, the backend employs **Strict Concurrency Bottlenecks** using `p-limit`. 
Massive memory-bound processes are mathematically queued to execute sequentially (one after another) rather than concurrently. This stabilizes the server completely, trading off minor latency spikes for 100% unbreakable uptime.

### ✨ Asynchronous UI Experiences
Because the backend enforces queues, users might experience longer waits during peak traffic (e.g., waiting 60+ seconds for a portfolio to compile and deploy to Cloudflare). 
To combat "freeze anxiety", the frontend utilizes **Zeno's Paradox Simulated Loaders**. The UI mathematically progresses asymptotically towards 99% alongside granular, time-based rotating messages. This reassures users the app is actively working, drastically reducing early bounce rates without requiring complex bidirectional WebSockets.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- MongoDB connection string
- Firebase Auth credentials
- Groq API keys

### Booting the Development Environment

1. **Install Dependencies Globally**
   Navigate to both folders and run:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. **Environment Configuration**
   Populate the `.env` variables required by both sub-directories. *(Refer to the individual README documents inside `/frontend` and `/backend` for specifics.)*

3. **Start the Servers**
   Spin up both instances simultaneously.
   ```bash
   # Terminal 1
   cd backend && npm run dev
   
   # Terminal 2
   cd frontend && npm run dev
   ```

---

## 🛡️ Best Practices & Security
- **Never commit `.env` files**: All API keys, especially Firebase Service Accounts and Groq Keys, must remain entirely secured.
- **Rate Limiting enforced**: The Node routing layer employs strict `express-rate-limit` implementations. Ensure that any future proxy layers (like Nginx) correctly forward the IP headers for anti-abuse mechanics to maintain integrity.

> Developed with a primary focus on Premium Aesthetics, Speed, and Engineering Resilience.
