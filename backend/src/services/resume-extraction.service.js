import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const urlRegex = /https?:\/\/[^\s)]+/gi;
const headingRegex = /^(?:#+\s*)?(skills?|technical skills?|projects?|achievements?|experience|work experience|professional experience)\s*:?$/i;

const mask = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /(?:(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4})/g,
  linkedIn: /https?:\/\/(?:www\.)?linkedin\.com\/[A-Za-z0-9\-_/?.=&%#]+/gi,
  github: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9\-_/?.=&%#]+/gi
};

const readTextFile = async (filePath) => fs.readFile(filePath, "utf8");

const readPdfText = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return parsed.text || "";
  } finally {
    await parser.destroy();
  }
};

const readDocxText = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
};

const readImageText = async (filePath) => {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(filePath);
    return result.data?.text || "";
  } finally {
    await worker.terminate();
  }
};

export const extractResumeRawText = async (resume) => {
  const existing = resume.content?.trim();
  if (existing && existing !== "Uploaded resume") {
    return existing;
  }

  if (!resume.filePath) {
    return "";
  }

  const absoluteFilePath = path.join(process.cwd(), resume.filePath.replace(/^\//, ""));
  const extension = path.extname(absoluteFilePath).toLowerCase();

  if (extension === ".txt" || extension === ".tex") {
    return readTextFile(absoluteFilePath);
  }

  if (extension === ".pdf") {
    return readPdfText(absoluteFilePath);
  }

  if (extension === ".docx") {
    return readDocxText(absoluteFilePath);
  }

  if (new Set([".png", ".jpg", ".jpeg", ".webp"]).has(extension)) {
    return readImageText(absoluteFilePath);
  }

  return "";
};

export const extractUrls = (text) => Array.from(new Set((text.match(urlRegex) || []).map((item) => item.trim())));

export const redactSensitiveInfo = (text) => {
  const findings = [];
  let redacted = text;

  const replaceAndTrack = (regex, token, label) => {
    const matches = redacted.match(regex);
    if (matches?.length) {
      findings.push(`${label}:${matches.length}`);
      redacted = redacted.replace(regex, token);
    }
  };

  replaceAndTrack(mask.email, "[REDACTED_EMAIL]", "email");
  replaceAndTrack(mask.phone, "[REDACTED_PHONE]", "phone");
  replaceAndTrack(mask.linkedIn, "[REDACTED_LINKEDIN_URL]", "linkedin");
  replaceAndTrack(mask.github, "[REDACTED_GITHUB_URL]", "github");

  return {
    redactedText: redacted,
    findings
  };
};

export const extractLatexSections = (latexSource) => {
  const sectionRegex = /\\section\*?\{([^}]+)\}/g;
  const names = [];
  let match = sectionRegex.exec(latexSource);
  while (match) {
    names.push(match[1].trim());
    match = sectionRegex.exec(latexSource);
  }

  return Array.from(new Set(names));
};

const normalizeSkill = (value) =>
  value
    .replace(/^[\-•*]+\s*/, "")
    .replace(/`/g, "")
    .trim();

export const extractFocusedResumeSections = (rawText) => {
  const lines = rawText.split(/\r?\n/);
  const sections = {
    skills: [],
    projects: [],
    achievements: [],
    experience: []
  };

  let current = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(headingRegex);
    if (headingMatch) {
      const heading = headingMatch[1].toLowerCase();
      if (heading.includes("skill")) {
        current = "skills";
      } else if (heading.includes("project")) {
        current = "projects";
      } else if (heading.includes("achievement")) {
        current = "achievements";
      } else {
        current = "experience";
      }
      continue;
    }

    if (current) {
      sections[current].push(line);
    }
  }

  const fallbackExperience = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60);

  return {
    skillsText: sections.skills.join("\n"),
    projectsText: sections.projects.join("\n"),
    achievementsText: sections.achievements.join("\n"),
    experienceText: (sections.experience.length ? sections.experience : fallbackExperience).join("\n")
  };
};

export const extractNormalizedSkills = (skillsText) => {
  const tokens = skillsText
    .split(/\r?\n|,|\||\//)
    .map((item) => normalizeSkill(item))
    .filter(Boolean)
    .filter((item) => item.length <= 60);

  return Array.from(new Set(tokens)).slice(0, 40);
};
