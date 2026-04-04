import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  expandProjectBullet,
  generateLatexSectionEdit,
  generateTailoredLatex,
  generateTailoredResume
} from "../services/groq.service.js";
import { compileLatexToPdf } from "../services/latex-compiler.service.js";
import {
  extractLatexSections,
  extractFocusedResumeSections,
  extractNormalizedSkills,
  extractResumeRawText,
  extractUrls,
  redactSensitiveInfo
} from "../services/resume-extraction.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { Resume } from "../models/resume.models.js";
import { TailoredResume } from "../models/tailoredResume.models.js";
import { Project } from "../models/project.models.js";
import { findUserByFirebaseUid } from "../services/user.service.js";
import {
  AchievementEntry,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  normalizeSkillBuckets,
  normalizeTextArray,
  SkillSection
} from "../classes/profile.classes.js";

const tailorSchema = z.object({
  jobDescription: z.string().min(20, "jobDescription must be at least 20 characters"),
  resumeText: z.string().min(20, "resumeText must be at least 20 characters"),
  tone: z.enum(["professional", "confident", "concise"]).optional(),
  maxBullets: z.number().int().min(3).max(12).optional()
});

const tailorLatexSchema = z.object({
  jobDescription: z.string().min(20, "jobDescription must be at least 20 characters"),
  resumeId: z.string().min(1, "resumeId is required"),
  resumePayload: z.record(z.any()).optional(),
  approvedSkills: z.array(z.string().trim().min(1)).max(40).optional().default([]),
  approvedProjectIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  approvedExperienceIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  approvedAchievementIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  generateFromAllSaved: z.boolean().optional().default(false)
});

const tailorInputsSchema = z.object({
  resumeId: z.string().min(1, "resumeId is required"),
  jobDescription: z.string().optional().default("")
});

const editSectionSchema = z.object({
  tailoredResumeId: z.string().min(1, "tailoredResumeId is required"),
  sectionName: z.string().min(1, "sectionName is required"),
  editInstruction: z.string().min(5, "editInstruction must be at least 5 characters")
});

const acceptTailoredSchema = z.object({
  tailoredResumeId: z.string().min(1, "tailoredResumeId is required")
});

const expandProjectBulletSchema = z.object({
  bullet: z.string().min(8, "bullet must be at least 8 characters"),
  projectName: z.string().max(180).optional().default(""),
  technologies: z.string().max(300).optional().default(""),
  atsOptimized: z.boolean().optional().default(false),
  maxLines: z.number().int().min(1).max(30).optional().default(2)
});

const stripMarkdownCodeFence = (value) =>
  value
    .replace(/^```(?:latex)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();

const ensureLatexDocument = (latex) => {
  if (latex.includes("\\begin{document}") && latex.includes("\\end{document}")) {
    return latex;
  }

  return [
    "\\documentclass[11pt]{article}",
    "\\usepackage[margin=1in]{geometry}",
    "\\usepackage[T1]{fontenc}",
    "\\begin{document}",
    latex,
    "\\end{document}"
  ].join("\n");
};

const safeJsonParse = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizeText = (value) => (value || "").toString().trim();

const uniqueStrings = (items = []) => Array.from(new Set(items.map((item) => normalizeText(item)).filter(Boolean)));

const uniqueBy = (items = [], keyFn) => {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(item);
  }

  return output;
};

const collectSkillValues = (skills) => {
  if (!skills || typeof skills !== "object") {
    return [];
  }

  return [skills.languages, skills.frameworks, skills.tools, skills.libraries]
    .flat()
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const collectUserSkillValues = (user) => {
  const normalizedSkillBuckets = normalizeSkillBuckets({
    skillSections: user.skillSections,
    skillLanguages: user.skillLanguages,
    skillFrameworks: user.skillFrameworks,
    skillTools: user.skillTools,
    skillLibraries: user.skillLibraries
  });

  const sectionSkills = normalizedSkillBuckets.skillSections.flatMap((section) => section.skills || []);

  return [
    normalizedSkillBuckets.skillLanguages,
    normalizedSkillBuckets.skillFrameworks,
    normalizedSkillBuckets.skillTools,
    normalizedSkillBuckets.skillLibraries,
    sectionSkills
  ]
    .flat()
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const collectUserSkillSections = (user) => {
  return SkillSection.fromList(user.skillSections)
    .filter((section) => !section.isEmpty())
    .map((section) => section.toObject());
};

const collectUserExperienceValues = (user) => {
  return ExperienceEntry.fromList(user.experience)
    .filter((item) => !item.isEmpty())
    .map((item, index) => formatRecommendedExperience(item.toObject(), `user-experience-${index}`));
};

const collectUserAchievementValues = (user) => {
  return AchievementEntry.fromList(user.achievements)
    .filter((item) => !item.isEmpty())
    .map((item, index) => formatRecommendedAchievement(item.toObject(), `user-achievement-${index}`));
};

const collectStructuredExperienceBlocks = (user, fallbackStructuredResume) => {
  const userExperiences = ExperienceEntry.fromList(user.experience)
    .filter((item) => !item.isEmpty())
    .map((item) => item.toObject());

  if (userExperiences.length) {
    return userExperiences.map((item, index) => formatRecommendedExperience(item, `user-experience-${index}`));
  }

  return Array.isArray(fallbackStructuredResume?.experience)
    ? fallbackStructuredResume.experience.map((item, index) => formatRecommendedExperience(item, `resume-experience-${index}`))
    : [];
};

const collectStructuredAchievementBlocks = (user, fallbackStructuredResume) => {
  const userAchievements = AchievementEntry.fromList(user.achievements)
    .filter((item) => !item.isEmpty())
    .map((item) => item.toObject());

  if (userAchievements.length) {
    return userAchievements.map((item, index) => formatRecommendedAchievement(item, `user-achievement-${index}`));
  }

  return Array.isArray(fallbackStructuredResume?.achievements)
    ? fallbackStructuredResume.achievements.map((item, index) => formatRecommendedAchievement(item, `resume-achievement-${index}`))
    : [];
};

const toTextBlock = (label, items) => {
  if (!items.length) {
    return `${label}: N/A`;
  }

  return [label + ":", ...items.map((item) => `- ${item}`)].join("\n");
};

const buildExperienceText = (experience) => {
  const headline = [experience.role, experience.company, experience.location, experience.date].filter(Boolean).join(" | ");
  const bullets = Array.isArray(experience.bullets) ? experience.bullets : [];
  return [headline, ...bullets.map((bullet) => `  - ${bullet}`)].filter(Boolean).join("\n");
};

const buildProjectText = (project) => {
  const headline = [project.name, project.technologies, project.date].filter(Boolean).join(" | ");
  const bullets = Array.isArray(project.bullets) ? project.bullets : [];
  return [headline, ...bullets.map((bullet) => `  - ${bullet}`)].filter(Boolean).join("\n");
};

const buildAchievementText = (achievement) => {
  const headline = [achievement.title, achievement.date].filter(Boolean).join(" | ");
  const bullets = Array.isArray(achievement.bullets) ? achievement.bullets : [];
  return [headline, ...bullets.map((bullet) => `  - ${bullet}`)].filter(Boolean).join("\n");
};

const getResumeStructuredData = async (resume) => {
  const parsedContent = safeJsonParse(resume.content);
  if (parsedContent && typeof parsedContent === "object") {
    return {
      name: normalizeText(parsedContent.name),
      email: normalizeText(parsedContent.email),
      phone: normalizeText(parsedContent.phone),
      linkedin: normalizeText(parsedContent.linkedin),
      github: normalizeText(parsedContent.github),
      education: Array.isArray(parsedContent.education) ? parsedContent.education : [],
      experience: Array.isArray(parsedContent.experience) ? parsedContent.experience : [],
      projects: Array.isArray(parsedContent.projects) ? parsedContent.projects : [],
      achievements: Array.isArray(parsedContent.achievements) ? parsedContent.achievements : [],
      skills: parsedContent.skills && typeof parsedContent.skills === "object" ? parsedContent.skills : {}
    };
  }

  const extractedText = await extractResumeRawText(resume);
  const focusedSections = extractFocusedResumeSections(extractedText || "");

  return {
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    education: [],
    experience: focusedSections.experienceText
      ? focusedSections.experienceText
          .split(/\n+/)
          .map((item) => ({ role: item, company: "", location: "", date: "", bullets: [] }))
      : [],
    projects: focusedSections.projectsText
      ? focusedSections.projectsText
          .split(/\n+/)
          .map((item) => ({ name: item, technologies: "", date: "", bullets: [] }))
      : [],
    achievements: focusedSections.achievementsText
      ? focusedSections.achievementsText
          .split(/\n+/)
          .map((item) => ({ title: item, date: "", bullets: [] }))
      : [],
    skills: { languages: extractNormalizedSkills(focusedSections.skillsText) }
  };
};

const jdStopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "you",
  "your",
  "will",
  "must",
  "should",
  "years",
  "year",
  "experience",
  "developer",
  "engineer",
  "team",
  "role",
  "work"
]);

const tokenizeForMatching = (value) => {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !jdStopWords.has(token));
};

const extractJobKeywords = (jobDescription) => {
  const frequency = new Map();
  for (const token of tokenizeForMatching(jobDescription)) {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([token]) => token);
};

const scoreSkillForJd = (skill, jdKeywords) => {
  const skillTokens = new Set(tokenizeForMatching(skill));
  let score = 0;
  for (const keyword of jdKeywords) {
    if (skillTokens.has(keyword)) {
      score += 1;
    }
  }
  return score;
};

const buildJdResumeComment = ({ jdKeywords, skills = [], projects = [], experiences = [], achievements = [] }) => {
  const topKeywords = jdKeywords.slice(0, 8);
  const strongSkillMatches = skills.filter((item) => (item.relevanceScore || 0) > 0).slice(0, 5).map((item) => item.label);
  const strongProjects = projects.filter((item) => (item.relevanceScore || 0) > 0).slice(0, 3).map((item) => item.title);
  const strongExperiences = experiences.filter((item) => (item.relevanceScore || 0) > 0).slice(0, 3).map((item) => item.role || item.company);
  const strongAchievements = achievements.filter((item) => (item.relevanceScore || 0) > 0).slice(0, 3).map((item) => item.title);

  return [
    topKeywords.length
      ? `JD highlights: ${topKeywords.join(", ")}.`
      : "JD highlights are limited; broad saved profile relevance was used.",
    strongSkillMatches.length
      ? `Best matching skills from your saved profile: ${strongSkillMatches.join(", ")}.`
      : "Skills match is currently weak; you can manually select additional relevant skills.",
    strongProjects.length
      ? `Most relevant saved projects: ${strongProjects.join(" | ")}.`
      : "No strong project match found automatically; consider selecting alternate projects manually.",
    strongExperiences.length || strongAchievements.length
      ? `Experience/Achievement evidence selected: ${[...strongExperiences, ...strongAchievements].filter(Boolean).slice(0, 4).join(" | ")}.`
      : "Experience and achievements need more JD-aligned evidence; manual selections are recommended.",
    "You can unselect AI picks and choose any saved item before generating the final resume."
  ];
};

const scoreProjectForJd = (project, jdKeywords) => {
  const projectText = [project.name || project.title, project.description, project.technologies, ...(project.stack || []), ...(project.bullets || [])].join(" ");
  const projectTokens = new Set(tokenizeForMatching(projectText));

  let score = 0;
  for (const keyword of jdKeywords) {
    if (projectTokens.has(keyword)) {
      score += 1;
    }
  }

  return score;
};

const scoreExperienceForJd = (experience, jdKeywords) => {
  const experienceText = [experience.role, experience.company, experience.location, experience.date, ...(experience.bullets || [])].join(" ");
  const tokens = new Set(tokenizeForMatching(experienceText));
  let score = 0;
  for (const keyword of jdKeywords) {
    if (tokens.has(keyword)) {
      score += 1;
    }
  }
  return score;
};

const scoreAchievementForJd = (achievement, jdKeywords) => {
  const achievementText = [achievement.title, achievement.date, ...(achievement.bullets || [])].join(" ");
  const tokens = new Set(tokenizeForMatching(achievementText));
  let score = 0;
  for (const keyword of jdKeywords) {
    if (tokens.has(keyword)) {
      score += 1;
    }
  }
  return score;
};

const rankProjectsForJd = (projects, jdKeywords) => {
  return projects
    .map((project) => ({ project, score: scoreProjectForJd(project, jdKeywords) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return new Date(b.project.updatedAt).getTime() - new Date(a.project.updatedAt).getTime();
    });
};

const pickTopProjectsForJd = (projects, jdKeywords) => {
  const ranked = rankProjectsForJd(projects, jdKeywords);
  const positive = ranked.filter((item) => item.score > 0).slice(0, 3);
  return positive.length === 3 ? positive : ranked.slice(0, 3);
};

const recommendSkillsForJd = ({ normalizedSkills, projects, jdKeywords }) => {
  const jdKeywordSet = new Set(jdKeywords);
  const candidates = [
    ...normalizedSkills,
    ...projects.flatMap((project) => project.stack || [])
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean);

  const uniqueCandidates = Array.from(new Set(candidates));
  const prioritized = [];
  const fallback = [];

  for (const skill of uniqueCandidates) {
    const skillTokens = tokenizeForMatching(skill);
    const matched = skillTokens.some((token) => jdKeywordSet.has(token));
    if (matched) {
      prioritized.push(skill);
    } else {
      fallback.push(skill);
    }
  }

  return [...prioritized, ...fallback].slice(0, 14);
};

const rankStructuredItems = (items, scorer) => {
  return items
    .map((item, index) => ({
      ...item,
      id: item.id || String(index),
      relevanceScore: scorer(item)
    }))
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      return String(a.id).localeCompare(String(b.id));
    });
};

const formatRecommendedProject = (project) => {
  const normalized = ProjectEntry.from(project).toObject();

  return {
    id: String(project._id || project.id || ""),
    title: normalized.title,
    description: normalized.description,
    stack: normalized.stack,
    date: normalized.date,
    githubUrl: normalized.githubUrl,
    demoUrl: normalized.demoUrl
  };
};

const formatRecommendedExperience = (experience, id) => ({
  id,
  role: experience.role || "",
  company: experience.company || "",
  location: experience.location || "",
  date: experience.date || "",
  bullets: Array.isArray(experience.bullets) ? experience.bullets : []
});

const formatRecommendedAchievement = (achievement, id) => ({
  id,
  title: achievement.title || "",
  date: achievement.date || "",
  bullets: Array.isArray(achievement.bullets) ? achievement.bullets : []
});

const formatResumeSnapshot = (resumeData) => ({
  name: resumeData.name || "",
  phone: resumeData.phone || "",
  email: resumeData.email || "",
  linkedin: resumeData.linkedin || "",
  github: resumeData.github || ""
});

const formatEducationEntry = (entry) => {
  return EducationEntry.from(entry).toSummaryLine();
};

const buildStructuredSourceForAi = ({
  resumePayload
}) => {
  return [
    "Candidate Structured Resume Data (keep each object as exactly one resume block):",
    JSON.stringify(resumePayload, null, 2),
    "Rules:",
    "1) Do not split one experience object into multiple separate entries.",
    "2) Do not split one achievement object into multiple separate entries.",
    "3) Keep title, company, date, location, description, and bullets together inside one block.",
    "4) Skills may be grouped by section, but each section should remain a single block.",
    "5) Preserve the original item grouping from the source data while improving ATS wording.",
    "6) Prefer concise, truthful LaTeX output with one block per saved item."
  ].join("\n\n");
};

const injectProfileIntoLatex = (latexSource, profile) => {
  const headerLines = [
    "\\begin{center}",
    `{\\LARGE \\textbf{${(profile.name || "Candidate").replace(/[{}]/g, "")}}}\\\\`,
    profile.email ? profile.email.replace(/[{}]/g, "") : "",
    profile.linkedInUrl ? `\\\\${profile.linkedInUrl.replace(/[{}]/g, "")}` : "",
    profile.githubUrl ? `\\\\${profile.githubUrl.replace(/[{}]/g, "")}` : "",
    profile.leetCodeId ? `\\\\LeetCode: ${profile.leetCodeId.replace(/[{}]/g, "")}` : "",
    profile.geeksForGeeksId ? `\\\\GeeksforGeeks: ${profile.geeksForGeeksId.replace(/[{}]/g, "")}` : "",
    "\\end{center}",
    "\\vspace{0.2cm}"
  ]
    .filter(Boolean)
    .join("\n");

  const educationBlock = profile.education.length
    ? ["\\section*{Education}", "\\begin{itemize}", ...profile.education.map((item) => `\\item ${item.replace(/[{}]/g, "")}`), "\\end{itemize}"]
        .join("\n")
    : "";

  let latex = latexSource;
  latex = latex.replace(/\\begin\{document\}/, `\\begin{document}\n${headerLines}`);

  if (educationBlock && !/\\section\*?\{education\}/i.test(latex)) {
    latex = latex.replace(/\\end\{document\}/, `${educationBlock}\n\\end{document}`);
  }

  return latex;
};

const writeTailoredArtifacts = async (latexSource) => {
  const outputDir = path.join(process.cwd(), "uploads", "tailored");
  await fs.mkdir(outputDir, { recursive: true });

  const fileStem = `${Date.now()}-${randomUUID()}-tailored`;
  const texFileName = `${fileStem}.tex`;
  const pdfFileName = `${fileStem}.pdf`;
  const texFilePath = path.join(outputDir, texFileName);
  const pdfFilePath = path.join(outputDir, pdfFileName);

  await fs.writeFile(texFilePath, latexSource, "utf8");

  let compileEngine = "node-latex-pdf";
  try {
    compileEngine = await compileLatexToPdf(texFilePath, outputDir);
  } catch (error) {
    throw new ApiError(
      500,
      "LaTeX PDF compilation failed. Ensure MiKTeX and pdflatex are installed and configured.",
      [error instanceof Error ? error.message : "Unknown LaTeX compilation error"]
    );
  }

  try {
    await fs.access(pdfFilePath);
  } catch {
    throw new ApiError(500, "PDF compilation did not produce an output file");
  }

  return {
    texPath: `/uploads/tailored/${texFileName}`,
    pdfPath: `/uploads/tailored/${pdfFileName}`,
    compileEngine
  };
};

export const tailorResume = asyncHandler(async (req, res) => {
  const parsed = tailorSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid AI tailor payload", parsed.error.issues);
  }

  let tailoredText = "";

  try {
    tailoredText = await generateTailoredResume(parsed.data);
  } catch (error) {
    throw new ApiError(502, error instanceof Error ? error.message : "AI provider request failed");
  }

  if (!tailoredText) {
    throw new ApiError(502, "AI provider returned an empty response");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        tailoredText,
        metadata: {
          provider: "groq",
          model: env.GROQ_MODEL
        }
      },
      "Resume tailored successfully"
    )
  );
});

export const tailorResumeLatex = asyncHandler(async (req, res) => {
  const parsed = tailorLatexSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid AI LaTeX tailor payload", parsed.error.issues);
  }

  const user = await findUserByFirebaseUid(req.auth.uid);
  const resume = await Resume.findOne({ _id: parsed.data.resumeId, owner: user._id });

  if (!resume) {
    throw new ApiError(404, "Resume not found");
  }

  const structuredResume = await getResumeStructuredData(resume);
  const extractedText = await extractResumeRawText(resume);

  if (!extractedText || extractedText.trim().length < 30) {
    throw new ApiError(400, "Unable to extract enough text from selected resume for tailoring");
  }

  const extractedUrls = extractUrls(extractedText);
  const { redactedText, findings } = redactSensitiveInfo(extractedText);
  const focusedSections = extractFocusedResumeSections(redactedText);
  const userSkillValues = collectUserSkillValues(user);
  const normalizedSkills = extractNormalizedSkills(
    [...userSkillValues, ...collectSkillValues(structuredResume.skills)].length
      ? [...userSkillValues, ...collectSkillValues(structuredResume.skills)].join("\n")
      : focusedSections.skillsText
  );
  const userProjects = await Project.find({ owner: user._id }).sort({ updatedAt: -1 }).lean();
  const jdKeywords = extractJobKeywords(parsed.data.jobDescription);
  const rankedProjects = rankProjectsForJd(userProjects, jdKeywords);
  const recommendedProjects = rankedProjects.map((item) => ({
    ...formatRecommendedProject(item.project),
    relevanceScore: item.score
  }));

  const structuredExperiences = collectStructuredExperienceBlocks(user, structuredResume);
  const structuredAchievements = collectStructuredAchievementBlocks(user, structuredResume);

  const rankedExperiences = rankStructuredItems(structuredExperiences, (item) => scoreExperienceForJd(item, jdKeywords));
  const rankedAchievements = rankStructuredItems(structuredAchievements, (item) => scoreAchievementForJd(item, jdKeywords));

  const recommendedSkills = recommendSkillsForJd({
    normalizedSkills,
    projects: recommendedProjects,
    jdKeywords
  });

  const approvedSkillSet = new Set(parsed.data.approvedSkills.map((item) => item.trim()).filter(Boolean));
  const approvedProjectIdSet = new Set(parsed.data.approvedProjectIds.map((item) => item.trim()).filter(Boolean));
  const approvedExperienceIdSet = new Set(parsed.data.approvedExperienceIds.map((item) => item.trim()).filter(Boolean));
  const approvedAchievementIdSet = new Set(parsed.data.approvedAchievementIds.map((item) => item.trim()).filter(Boolean));

  const selectedProjects = userProjects
    .filter((project) => approvedProjectIdSet.has(String(project._id)))
    .slice(0, 3)
    .map((project) => formatRecommendedProject(project));

  const selectedExperiences = rankedExperiences
    .filter((item) => approvedExperienceIdSet.has(item.id))
    .slice(0, 6);

  const selectedAchievements = rankedAchievements
    .filter((item) => approvedAchievementIdSet.has(item.id))
    .slice(0, 6);

  const selectedSkills = parsed.data.approvedSkills.length
    ? Array.from(approvedSkillSet).slice(0, 20)
    : recommendedSkills;

  const selectedProjectsForAi = selectedProjects.length ? selectedProjects : recommendedProjects;

  const skillViewsForComment = uniqueStrings(recommendedSkills).map((skill, index) => ({
    id: `skill-${index}`,
    label: skill,
    relevanceScore: scoreSkillForJd(skill, jdKeywords)
  }));

  const profileSnapshot = {
    ...formatResumeSnapshot(structuredResume),
    name: structuredResume.name || user.displayName || "",
    email: structuredResume.email || user.email || "",
    linkedInUrl: user.linkedInUrl || "",
    githubUrl: user.githubUrl || "",
    leetCodeId: user.leetCodeId || "",
    geeksForGeeksId: user.geeksForGeeksId || "",
    education: Array.isArray(user.educationEntries) && user.educationEntries.length
      ? EducationEntry.fromList(user.educationEntries)
          .filter((entry) => !entry.isEmpty())
          .map((entry) => entry.toSummaryLine())
      : normalizeTextArray(user.education)
  };

  const frontendResumePayload = parsed.data.resumePayload && typeof parsed.data.resumePayload === "object" ? parsed.data.resumePayload : null;

  const resumePayload = frontendResumePayload || {
    jobDescription: parsed.data.jobDescription,
    profile: {
      name: profileSnapshot.name,
      email: profileSnapshot.email,
      phone: profileSnapshot.phone,
      linkedin: profileSnapshot.linkedInUrl,
      github: profileSnapshot.githubUrl
    },
    skills: {
      selected: selectedSkills,
      recommended: recommendedSkills,
      all: skillViewsForComment
    },
    projects: {
      selected: selectedProjectsForAi,
      recommended: recommendedProjects,
      all: recommendedProjects,
      selectedIds: selectedProjects.map((item) => item.id)
    },
    experiences: {
      selected: selectedExperiences,
      all: rankedExperiences,
      selectedIds: selectedExperiences.map((item) => item.id)
    },
    achievements: {
      selected: selectedAchievements,
      all: rankedAchievements,
      selectedIds: selectedAchievements.map((item) => item.id)
    },
    education: profileSnapshot.education
  };

  const aiSource = buildStructuredSourceForAi({ resumePayload });

  const jdResumeComment = buildJdResumeComment({
    jdKeywords,
    skills: skillViewsForComment,
    projects: recommendedProjects,
    experiences: rankedExperiences,
    achievements: rankedAchievements
  });

  let tailoredLatex = "";
  try {
    tailoredLatex = await generateTailoredLatex({
      jobDescription: parsed.data.jobDescription,
      resumeSource: aiSource
    });
  } catch (error) {
    throw new ApiError(502, error instanceof Error ? error.message : "AI provider request failed");
  }

  if (!tailoredLatex) {
    throw new ApiError(502, "AI provider returned empty LaTeX output");
  }

  const cleanedLatex = ensureLatexDocument(stripMarkdownCodeFence(tailoredLatex));
  const latexWithProfile = injectProfileIntoLatex(cleanedLatex, profileSnapshot);
  const artifact = await writeTailoredArtifacts(latexWithProfile);
  const sectionNames = extractLatexSections(latexWithProfile);

  const tailored = await TailoredResume.create({
    owner: user._id,
    sourceResume: resume._id,
    jobDescription: parsed.data.jobDescription,
    extractedText,
    focusedSections,
    normalizedSkills,
    profileSnapshot,
    redactedText,
    extractedUrls,
    sensitiveFindings: findings,
    latexSource: latexWithProfile,
    sectionNames,
    pdfPath: artifact.pdfPath,
    texPath: artifact.texPath,
    compileEngine: artifact.compileEngine,
    status: "draft"
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        tailoredResumeId: tailored._id,
        tailoredLatex: latexWithProfile,
        pdfPath: artifact.pdfPath,
        texPath: artifact.texPath,
        compileEngine: artifact.compileEngine,
        sectionNames,
        normalizedSkills,
        recommendedSkills,
        recommendedProjects,
        recommendedExperiences: rankedExperiences,
        recommendedAchievements: rankedAchievements,
        selectedSkills,
        selectedProjects: selectedProjectsForAi,
        jdResumeComment,
        extractedUrls,
        redactionSummary: findings,
        status: tailored.status
      },
      "Final tailored resume generated successfully"
    )
  );
});

export const getTailorInputs = asyncHandler(async (req, res) => {
  const parsed = tailorInputsSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid tailor input payload", parsed.error.issues);
  }

  const user = await findUserByFirebaseUid(req.auth.uid);
  const resume = await Resume.findOne({ _id: parsed.data.resumeId, owner: user._id });

  if (!resume) {
    throw new ApiError(404, "Resume not found");
  }

  const structuredResume = await getResumeStructuredData(resume);
  const extractedText = await extractResumeRawText(resume);
  const focusedSections = extractFocusedResumeSections(extractedText || "");
  const userSkillValues = collectUserSkillValues(user);
  const userSkillSections = collectUserSkillSections(user);
  const normalizedSkills = extractNormalizedSkills(
    [...userSkillValues, ...collectSkillValues(structuredResume.skills)].length
      ? [...userSkillValues, ...collectSkillValues(structuredResume.skills)].join("\n")
      : focusedSections.skillsText
  );
  const projects = await Project.find({ owner: user._id }).sort({ updatedAt: -1 }).lean();
  const jdKeywords = parsed.data.jobDescription.trim() ? extractJobKeywords(parsed.data.jobDescription) : [];

  const projectViews = projects.map((project) => ({
    ...formatRecommendedProject(project)
  }));

  const rankedProjectViews = rankProjectsForJd(projects, jdKeywords).map((item) => ({
        ...formatRecommendedProject(item.project),
        relevanceScore: item.score
      }));

  const structuredExperiences = collectStructuredExperienceBlocks(user, structuredResume);
  const structuredAchievements = collectStructuredAchievementBlocks(user, structuredResume);

  const rankedExperiences = (jdKeywords.length ? rankStructuredItems(structuredExperiences, (item) => scoreExperienceForJd(item, jdKeywords)) : structuredExperiences)
    .map((item, index) => ({ ...item, relevanceScore: item.relevanceScore ?? Math.max(structuredExperiences.length - index, 0) }));
  const rankedAchievements = (jdKeywords.length ? rankStructuredItems(structuredAchievements, (item) => scoreAchievementForJd(item, jdKeywords)) : structuredAchievements)
    .map((item, index) => ({ ...item, relevanceScore: item.relevanceScore ?? Math.max(structuredAchievements.length - index, 0) }));

  const skillViews = uniqueStrings(normalizedSkills).map((skill, index) => ({
    id: `skill-${index}`,
    label: skill,
    relevanceScore: scoreSkillForJd(skill, jdKeywords)
  }));

  const sectionViews = userSkillSections.length
    ? userSkillSections.map((section, sectionIndex) => ({
        id: `section-${sectionIndex}`,
        title: section.title || `Section ${sectionIndex + 1}`,
        skills: section.skills.map((skill) => {
          const existing = skillViews.find((item) => item.label.toLowerCase() === skill.toLowerCase());
          return existing || {
            id: `skill-${sectionIndex}-${skill}`,
            label: skill,
            relevanceScore: scoreSkillForJd(skill, jdKeywords)
          };
        })
      }))
    : [{ id: "section-0", title: "Skills", skills: skillViews }];

  const jdResumeComment = buildJdResumeComment({
    jdKeywords,
    skills: skillViews,
    projects: rankedProjectViews,
    experiences: rankedExperiences,
    achievements: rankedAchievements
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        skills: skillViews,
        skillSections: sectionViews,
        projects: rankedProjectViews,
        experiences: rankedExperiences,
        achievements: rankedAchievements,
        jdResumeComment
      },
      "Tailor input options fetched successfully"
    )
  );
});

export const editTailoredResumeSection = asyncHandler(async (req, res) => {
  const parsed = editSectionSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid edit payload", parsed.error.issues);
  }

  const user = await findUserByFirebaseUid(req.auth.uid);
  const tailored = await TailoredResume.findOne({ _id: parsed.data.tailoredResumeId, owner: user._id });

  if (!tailored) {
    throw new ApiError(404, "Tailored resume not found");
  }

  let editedLatex = "";
  try {
    editedLatex = await generateLatexSectionEdit({
      latexSource: tailored.latexSource,
      sectionName: parsed.data.sectionName,
      editInstruction: parsed.data.editInstruction,
      jobDescription: tailored.jobDescription
    });
  } catch (error) {
    throw new ApiError(502, error instanceof Error ? error.message : "AI provider request failed");
  }

  if (!editedLatex) {
    throw new ApiError(502, "AI provider returned empty LaTeX output");
  }

  const cleanedLatex = ensureLatexDocument(stripMarkdownCodeFence(editedLatex));
  const artifact = await writeTailoredArtifacts(cleanedLatex);
  const sectionNames = extractLatexSections(cleanedLatex);

  tailored.latexSource = cleanedLatex;
  tailored.pdfPath = artifact.pdfPath;
  tailored.texPath = artifact.texPath;
  tailored.compileEngine = artifact.compileEngine;
  tailored.sectionNames = sectionNames;
  tailored.edits.push({
    sectionName: parsed.data.sectionName,
    instruction: parsed.data.editInstruction,
    latexSource: cleanedLatex,
    pdfPath: artifact.pdfPath
  });

  await tailored.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        tailoredResumeId: tailored._id,
        tailoredLatex: tailored.latexSource,
        pdfPath: tailored.pdfPath,
        texPath: tailored.texPath,
        compileEngine: tailored.compileEngine,
        sectionNames: tailored.sectionNames
      },
      "Tailored section updated successfully"
    )
  );
});

export const acceptTailoredResume = asyncHandler(async (req, res) => {
  const parsed = acceptTailoredSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid accept payload", parsed.error.issues);
  }

  const user = await findUserByFirebaseUid(req.auth.uid);
  const tailored = await TailoredResume.findOneAndUpdate(
    { _id: parsed.data.tailoredResumeId, owner: user._id },
    { status: "accepted" },
    { new: true }
  );

  if (!tailored) {
    throw new ApiError(404, "Tailored resume not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        tailoredResumeId: tailored._id,
        status: tailored.status,
        pdfPath: tailored.pdfPath
      },
      "Tailored resume accepted"
    )
  );
});

export const extendProjectBullet = asyncHandler(async (req, res) => {
  const parsed = expandProjectBulletSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ApiError(400, "Invalid project bullet payload", parsed.error.issues);
  }

  // Verify authenticated user exists; expansion is available only for signed-in users.
  await findUserByFirebaseUid(req.auth.uid);

  let improvedBullet = "";
  try {
    improvedBullet = await expandProjectBullet(parsed.data);
  } catch (error) {
    throw new ApiError(502, error instanceof Error ? error.message : "AI provider request failed");
  }

  if (!improvedBullet) {
    throw new ApiError(502, "AI provider returned empty bullet output");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        improvedBullet
      },
      "Project bullet expanded successfully"
    )
  );
});
