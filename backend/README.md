# BuildMyResume Backend ⚙️

The robust Node.js backend powering the BuildMyResume platform, responsible for AI orchestration, heavy file processing, security, and automated code deployment.

## 🛠️ Tech Stack & Architecture

- **Core Framework:** Node.js with Express 5 (enabling native Promises for cleaner async/await routing).
- **Language:** Modular JavaScript (ESM - `type: "module"`).
- **Database:** MongoDB via Mongoose, providing an incredibly flexible document schema necessary for complex, highly nested JSON structures like parsed Resumes and User Profiles.
- **Authentication:** Firebase Admin SDK securely verifies JWT tokens passed from the frontend and hydrates user session details consistently.
- **AI Engine:** Groq SDK coupled with Langchain. Groq was specifically chosen over traditional OpenAI endpoints due to its LPU (Language Processing Unit) architecture, delivering generation speeds nearly 10x faster, ensuring real-time UI/UX fluidity for resume rewriting and AI tailoring.

## 🧠 Key Approaches

### Defensive Concurrency Algorithms
Because the backend frequently parses heavy files (PDFs via `pdf-parse`, Images via `tesseract.js`) and dynamically runs React builds (`vite build`), doing so concurrently on cloud free-tiers traditionally leads to instant OOM (Out-of-Memory) crashes.
We specifically architected **Singleton Queue Bottlenecks** using `p-limit`. This acts as an invisible queuing system where massive memory-bound tasks are forced to run sequentially, ensuring the server stays memory-safe and 100% online under intense load spikes.

### Layered Rate Limiting
To defend against abusive traffic, scraping, and heavy memory exhaustion, the APIs are protected using `express-rate-limit`. High-cost endpoints (like OCR parsing and AI Generation) are strictly limited per IP window to maintain infrastructure integrity.

### Automated Serverless Deployment
When a user clicks "Deploy Portfolio", the backend orchestrates a complex internal workflow:
1. Pulls JSON Profile data from MongoDB.
2. Injects it dynamically into a cached React Application template.
3. Builds the production bundle using local Node child processes.
4. Programmatically authenticates and uploads the `dist` folder to the Cloudflare Edge networks via their API.

## 📦 Local Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   You must set up a `.env` file (never committed to Git) in the root of `/backend`.
   Required variables include Mongo URI, Groq API Key, Firebase service account credentials, and Cloudflare tokens.

3. **Run Dev Server:**
   ```bash
   npm run dev
   ```
   *Runs on port 5000 by default using nodemon for hot reloading.*
