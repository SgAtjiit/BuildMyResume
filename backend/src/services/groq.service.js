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

export const generateTailoredLatex = async ({ jobDescription, resumeSource }) => {
  const systemPrompt = [
    "You are a senior ATS resume architect and LaTeX engineer.",
    "Generate resume LaTeX that is ATS-optimized and honest to source evidence.",
    "Keep measurable impact bullets and JD keyword alignment.",
    "Preserve item grouping: one experience object must render as one Experience block, and one achievement object must render as one Achievement block.",
    "Do not split a single saved item into multiple separate LaTeX blocks.",
    "The provided resume source is structured JSON. Read it as grouped objects and preserve those groups.",
    "Output must be standalone, compilable LaTeX only.",
    "Must include \\documentclass, \\begin{document}, and \\end{document}.",
    "Do not include markdown fences or explanations."
  ].join(" ");

  const userPrompt = [
    "Target Job Description:",
    jobDescription,
    "Base Resume Source (structured JSON):",
    resumeSource,
    "Instructions:",
    "1) Keep claims truthful to source.",
    "2) Preserve the JSON grouping: each experience object stays one Experience block, each achievement object stays one Achievement block, and each project object stays one Project block.",
    "3) If skills are grouped by section, keep the section title and its skills together.",
    "4) If recommended items are present, prioritize them but do not merge unrelated objects together.",
    "5) Use the selected items if they exist; otherwise use the recommended items.",
    "6) Prioritize JD-relevant achievements and ATS keywords.",
    "7) Use concise, strong action verbs and quantifiable impact.",
    "8) Keep section order systematic: Summary, Skills, Experience, Projects, Education.",
    "9) Preserve clean, compilable LaTeX."
  ].join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      temperature: 0.3,
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

export const generateLatexSectionEdit = async ({ latexSource, sectionName, editInstruction, jobDescription }) => {
  const systemPrompt = [
    "You are a LaTeX resume editor.",
    "Modify ONLY the requested section while preserving all other sections unchanged.",
    "Return full standalone LaTeX document that compiles.",
    "Do not add markdown fences or commentary."
  ].join(" ");

  const userPrompt = [
    "Target section to edit:",
    sectionName,
    "Job description context:",
    jobDescription || "N/A",
    "User edit request:",
    editInstruction,
    "Current LaTeX source:",
    latexSource,
    "Strict constraints:",
    "1) Keep all unrelated sections semantically unchanged.",
    "2) Improve ATS fit for edited section.",
    "3) Return complete LaTeX source."
  ].join("\n\n");

  try {
    const completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL,
      temperature: 0.2,
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
