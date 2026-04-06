import Groq from "groq-sdk";
import { env } from "../config/env.js";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export const generateTailoredResume = async ({
  jobDescription,
  resumeText,
  tone = "professional",
  maxBullets = 6
}) => {
  const systemPrompt = [
    "You are an expert resume writer and recruiter assistant.",
    "Tailor the resume content to the job description while preserving truthful claims.",
    "Return concise markdown with these sections:",
    "1) Summary",
    "2) Key Skills",
    "3) Experience Bullets (max requested count)",
    "4) ATS Keywords"
  ].join(" ");

  const userPrompt = [
    `Tone: ${tone}`,
    `Maximum experience bullets: ${maxBullets}`,
    "Job Description:",
    jobDescription,
    "Current Resume:",
    resumeText
  ].join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    return completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : "Unknown Groq API error";
    throw new Error(`Groq request failed: ${providerMessage}`);
  }
};


export const expandProjectBullet = async ({
  bullet,
  projectName = "",
  technologies = "",
  atsOptimized = false,
  maxLines = 2
}) => {
  const systemPrompt = [
    "You are an expert technical resume writer.",
    "Rewrite one project bullet into a stronger, ATS-friendly bullet while keeping it truthful.",
    "Return ONLY one bullet line without markdown or explanations.",
    "Use an action verb, technical depth, and outcome-oriented phrasing.",
    `Target output that fits within at most ${maxLines} wrapped resume lines.`,
    `Aim for roughly ${Math.max(12, maxLines * 10)} to ${Math.max(16, maxLines * 14)} words, depending on line budget.`
  ].join(" ");

  const userPrompt = [
    `Original bullet: ${bullet}`,
    `Project name: ${projectName || "N/A"}`,
    `Technologies: ${technologies || "N/A"}`,
    `ATS optimized mode: ${atsOptimized ? "ON" : "OFF"}`,
    `Maximum wrapped lines allowed: ${maxLines}`,
    "Constraints:",
    "1) Keep facts grounded in given context; do not fabricate metrics.",
    "2) If no metrics exist, use qualitative impact wording.",
    "3) Keep technical nouns relevant to the listed technologies.",
    "4) Keep phrasing compact enough to fit the line budget.",
    "5) Output exactly one improved bullet sentence."
  ].join("\n");

  try {
    const completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      temperature: 0.35,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    return completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : "Unknown Groq API error";
    throw new Error(`Groq request failed: ${providerMessage}`);
  }
};

export const generateProfileSummary = async ({
  profileSource,
  tone = "professional",
  maxWords = 90
}) => {
  const safeMaxWords = Number.isFinite(maxWords) ? Math.min(Math.max(Math.trunc(maxWords), 40), 180) : 90;

  const systemPrompt = [
    "You are an expert personal branding and resume writing assistant.",
    "Write a concise first-person profile summary that is factual and ATS-friendly.",
    "Use only information provided in the source data.",
    "Do not invent employers, achievements, metrics, or technologies.",
    "Return plain text only, no markdown, no bullets, no heading."
  ].join(" ");

  const userPrompt = [
    `Tone: ${tone}`,
    `Maximum words: ${safeMaxWords}`,
    "Profile source data:",
    profileSource,
    "Instructions:",
    "1) Mention strongest skills and project/achievement evidence when available.",
    "2) Keep it natural and confident, suitable for portfolio/resume summary section.",
    "3) 3 to 5 sentences maximum.",
    "4) Output plain text only."
  ].join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      temperature: 0.35,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    return completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : "Unknown Groq API error";
    throw new Error(`Groq request failed: ${providerMessage}`);
  }
};

