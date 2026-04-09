# BuildMyResume Frontend 🚀

The frontend application for BuildMyResume, built with a modern React tech stack focused on high-performance, seamless UX, and beautiful responsive design.

## 🛠️ Tech Stack & Architecture

- **Core:** React 18 powered by Vite. We chose Vite over Webpack or CRA for its significantly faster Hot Module Replacement (HMR) and optimized build times.
- **Language:** TypeScript for strict type-safety, which drastically reduces runtime errors and improves the developer experience with robust autocomplete.
- **Styling:** Tailwind CSS integrated with customized Shadcn UI components. This gives us accessible (Radix UI) UI primitives while maintaining complete thematic control.
- **Animations:** Framer Motion for rich, micro-interactions and smooth page transitions that make the app feel alive and premium.
- **Routing:** React Router v6 for client-side, instant page navigation without full reloads.
- **Data Fetching:** Standard `fetch` with modular wrappers inside `src/lib/api.ts` to attach Firebase Auth tokens and construct backend URLs securely.
- **Validation:** React Hook Form coupled with Zod for robust, schema-driven client-side form validation.

## 🧠 Key Approaches

### Asynchronous & Graceful UX
Because heavy backend operations (like generating and deploying a portfolio codebase) can take anywhere from 45 to 60 seconds, the frontend implements **Zeno's Paradox Simulated Loaders**. Instead of freezing the UI or relying on unstable WebSockets, we use asymptotic progress bars and rotating, time-based success messages to keep users engaged during long latency windows.

### Zero-Config Themes
The frontend manages and passes down "Design System" preferences (Themes, Typography, Colors) defined by the user in the Dashboard, parsing them strictly and sending them to the backend compiler without requiring developers to touch CSS.

## 📦 Local Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file mirroring `.env.example`.
   Ensure `VITE_BACKEND_URL` is mapped to your local Express server (e.g., `http://localhost:5000`).

3. **Run Dev Server:**
   ```bash
   npm run dev
   ```

4. **Production Build:**
   ```bash
   npm run build
   ```
