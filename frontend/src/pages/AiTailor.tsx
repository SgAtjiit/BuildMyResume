import { motion } from "framer-motion";
import { Sparkles, FileDown, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/use-auth";
import { apiRequest } from "@/lib/api";
import JakeResumePreview from "@/components/resume/JakeResumePreview";
import { jsPDF } from "jspdf";
import type { Achievement, Education, Experience, Project, ResumeData } from "@/components/resume/ResumeTypes";
import { getRenderableSkillLines } from "@/components/resume/skillFormat";

type ResumeItem = {
  _id: string;
  title: string;
  content: string;
  format: "PDF" | "DOCX" | "TXT" | "TEX" | "IMAGE";
  originalFileName?: string;
  updatedAt: string;
};

type ResumeSaveResponse = {
  resume: ResumeItem;
};

type BackendUserShape = {
  displayName?: string;
  email?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  educationEntries?: {
    degree?: string;
    specialization?: string;
    college?: string;
    location?: string;
    endDate?: string;
    grade?: string;
  }[];
  education?: string[];
  skillSections?: { title?: string; skills?: string[] }[];
  skillLanguages?: string[];
  skillFrameworks?: string[];
  skillTools?: string[];
  skillLibraries?: string[];
  experience?: { role?: string; company?: string; location?: string; date?: string; bullets?: string[] }[];
  achievements?: { title?: string; date?: string; bullets?: string[] }[];
};

type TailorLatexResponse = {
  tailoredResumeId: string;
  tailoredLatex: string;
  pdfPath: string;
  texPath: string;
  compileEngine: string;
  sectionNames: string[];
  normalizedSkills: string[];
  recommendedSkills: string[];
  recommendedProjects: {
    id: string;
    title: string;
    description: string;
    stack: string[];
    githubUrl: string;
    demoUrl: string;
    relevanceScore?: number;
  }[];
  recommendedExperiences: {
    id: string;
    role: string;
    company: string;
    location: string;
    date: string;
    bullets: string[];
    relevanceScore?: number;
  }[];
  recommendedAchievements: {
    id: string;
    title: string;
    date: string;
    bullets: string[];
    relevanceScore?: number;
  }[];
  jdResumeComment?: string[];
  extractedUrls: string[];
  redactionSummary: string[];
  status: "draft" | "accepted";
};

type TailorInputOptions = {
  skillSections?: {
    id: string;
    title: string;
    skills: {
      id: string;
      label: string;
      relevanceScore: number;
    }[];
  }[];
  skills: {
    id: string;
    label: string;
    relevanceScore: number;
  }[];
  projects: {
    id: string;
    title: string;
    description: string;
    stack: string[];
    githubUrl: string;
    demoUrl: string;
    relevanceScore: number;
  }[];
  experiences: {
    id: string;
    role: string;
    company: string;
    location: string;
    date: string;
    bullets: string[];
    relevanceScore: number;
  }[];
  achievements: {
    id: string;
    title: string;
    date: string;
    bullets: string[];
    relevanceScore: number;
  }[];
  jdResumeComment?: string[];
};

const uniqueStrings = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const parseBullets = (value?: string) =>
  (value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const ensurePdfY = (doc: jsPDF, y: number) => {
  if (y > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return 36;
  }
  return y;
};

const pdfSerifFontFamily = "NotoSerif";
let pdfFontLoadPromise: Promise<Record<string, string>> | null = null;

const arrayBufferToBinaryString = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let result = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    result += String.fromCharCode(...chunk);
  }

  return result;
};

const loadPdfSerifFontData = async () => {
  if (!pdfFontLoadPromise) {
    pdfFontLoadPromise = (async () => {
      const [regular, bold, italic, boldItalic] = await Promise.all([
        fetch("/fonts/NotoSerif-Regular.ttf"),
        fetch("/fonts/NotoSerif-Bold.ttf"),
        fetch("/fonts/NotoSerif-Italic.ttf"),
        fetch("/fonts/NotoSerif-BoldItalic.ttf")
      ]);

      const responses = [regular, bold, italic, boldItalic];
      if (responses.some((response) => !response.ok)) {
        throw new Error("Failed to load embedded serif font files");
      }

      const [regularBuffer, boldBuffer, italicBuffer, boldItalicBuffer] = await Promise.all(
        responses.map((response) => response.arrayBuffer())
      );

      return {
        regular: arrayBufferToBinaryString(regularBuffer),
        bold: arrayBufferToBinaryString(boldBuffer),
        italic: arrayBufferToBinaryString(italicBuffer),
        bolditalic: arrayBufferToBinaryString(boldItalicBuffer)
      };
    })();
  }

  return pdfFontLoadPromise;
};

const ensurePdfSerifFont = async (doc: jsPDF) => {
  const fontList = doc.getFontList() as Record<string, string[]>;
  if (fontList[pdfSerifFontFamily]) {
    return;
  }

  const fontData = await loadPdfSerifFontData();
  const jsPdfDoc = doc as unknown as {
    addFileToVFS: (fileName: string, fileData: string) => void;
    addFont: (postScriptName: string, id: string, fontStyle: string, fontWeight?: number | string) => void;
  };

  jsPdfDoc.addFileToVFS("NotoSerif-Regular.ttf", fontData.regular);
  jsPdfDoc.addFileToVFS("NotoSerif-Bold.ttf", fontData.bold);
  jsPdfDoc.addFileToVFS("NotoSerif-Italic.ttf", fontData.italic);
  jsPdfDoc.addFileToVFS("NotoSerif-BoldItalic.ttf", fontData.bolditalic);

  jsPdfDoc.addFont("NotoSerif-Regular.ttf", pdfSerifFontFamily, "normal");
  jsPdfDoc.addFont("NotoSerif-Bold.ttf", pdfSerifFontFamily, "bold");
  jsPdfDoc.addFont("NotoSerif-Italic.ttf", pdfSerifFontFamily, "italic");
  jsPdfDoc.addFont("NotoSerif-BoldItalic.ttf", pdfSerifFontFamily, "bolditalic");
};

const generateResumePdfBlob = async (data: ResumeData) => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  await ensurePdfSerifFont(doc);
  let y = 36;
  const left = 36;
  const contentWidth = 540;
  const centerX = doc.internal.pageSize.getWidth() / 2;

  const writeLine = (text: string, x = left, lineHeight = 14) => {
    y = ensurePdfY(doc, y);
    doc.text(text, x, y);
    y += lineHeight;
  };

  const writeWrapped = (text: string, x = left, width = contentWidth, lineHeight = 14) => {
    const lines = doc.splitTextToSize(text, width);
    lines.forEach((line: string) => writeLine(line, x, lineHeight));
  };

  const writeLeftRight = (leftText: string, rightText?: string, lineHeight = 14) => {
    const right = (rightText ?? "").trim();
    const rightWidth = right ? doc.getTextWidth(right) : 0;
    const leftWidth = right ? Math.max(140, contentWidth - rightWidth - 12) : contentWidth;
    const leftLines = doc.splitTextToSize(leftText || "", leftWidth);

    if (!leftLines.length && right) {
      y = ensurePdfY(doc, y);
      doc.text(right, left + contentWidth, y, { align: "right" });
      y += lineHeight;
      return;
    }

    leftLines.forEach((line: string, index: number) => {
      y = ensurePdfY(doc, y);
      doc.text(line, left, y);
      if (index === 0 && right) {
        doc.text(right, left + contentWidth, y, { align: "right" });
      }
      y += lineHeight;
    });
  };

  const writeSectionTitle = (title: string) => {
    y += 8;
    y = ensurePdfY(doc, y);
    doc.setFont(pdfSerifFontFamily, "bold");
    doc.setFontSize(12);
    doc.text(title.toUpperCase(), left, y);
    y += 7;
    y = ensurePdfY(doc, y);
    doc.setLineWidth(0.8);
    doc.line(left, y, left + contentWidth, y);
    y += 11;
    doc.setFont(pdfSerifFontFamily, "normal");
    doc.setFontSize(10.5);
  };

  doc.setFont(pdfSerifFontFamily, "bold");
  doc.setFontSize(22);
  y = ensurePdfY(doc, y);
  doc.text(data.name || "Candidate", centerX, y, { align: "center" });
  y += 24;

  doc.setFont(pdfSerifFontFamily, "normal");
  doc.setFontSize(10);

  const contactLine = [data.phone, data.email, data.linkedin, data.github].filter(Boolean).join(" | ");
  if (contactLine) {
    const lines = doc.splitTextToSize(contactLine, contentWidth);
    lines.forEach((line: string) => {
      y = ensurePdfY(doc, y);
      doc.text(line, centerX, y, { align: "center" });
      y += 13;
    });
    y += 2;
  }

  if (data.education?.length) {
    writeSectionTitle("Education");
    data.education.forEach((item) => {
      doc.setFont(pdfSerifFontFamily, "bold");
      writeLeftRight(item.school || "", item.location || "", 14);

      doc.setFont(pdfSerifFontFamily, "italic");
      writeLeftRight([item.degree, item.grade].filter(Boolean).join(" - "), item.date || "", 14);

      doc.setFont(pdfSerifFontFamily, "normal");
      y += 3;
    });
  }

  if (data.experience?.length) {
    writeSectionTitle("Experience");
    data.experience.forEach((item) => {
      doc.setFont(pdfSerifFontFamily, "bold");
      doc.setFontSize(10.8);
      writeLeftRight(item.role || "", item.date || "", 14);

      doc.setFont(pdfSerifFontFamily, "italic");
      doc.setFontSize(10.2);
      writeLeftRight(item.company || "", item.location || "", 13);

      doc.setFont(pdfSerifFontFamily, "normal");
      doc.setFontSize(10);
      item.bullets.forEach((bullet) => writeWrapped(`- ${bullet}`, left + 14, contentWidth - 14, 13));
      y += 2;
    });
  }

  if (data.projects?.length) {
    writeSectionTitle("Projects");
    data.projects.forEach((item) => {
      doc.setFont(pdfSerifFontFamily, "bold");
      doc.setFontSize(10.8);
      y = ensurePdfY(doc, y);
      const nameText = item.name || "";
      doc.text(nameText, left, y);

      if (item.technologies) {
        doc.setFont(pdfSerifFontFamily, "italic");
        doc.setFontSize(10.2);
        const techText = ` | ${item.technologies}`;
        doc.text(techText, left + doc.getTextWidth(nameText) + 2, y);
      }

      if (item.date) {
        doc.setFont(pdfSerifFontFamily, "italic");
        doc.setFontSize(10.2);
        doc.text(item.date, left + contentWidth, y, { align: "right" });
      }
      y += 13;

      doc.setFont(pdfSerifFontFamily, "normal");
      doc.setFontSize(10);
      item.bullets.forEach((bullet) => writeWrapped(`- ${bullet}`, left + 14, contentWidth - 14, 13));
      y += 2;
    });
  }

  if (data.achievements?.length) {
    writeSectionTitle("Achievements");
    data.achievements.forEach((item) => {
      doc.setFont(pdfSerifFontFamily, "bold");
      doc.setFontSize(10.8);
      writeLeftRight(item.title || "", item.date || "", 14);
      doc.setFont(pdfSerifFontFamily, "normal");
      doc.setFontSize(10);
      item.bullets.forEach((bullet) => writeWrapped(`- ${bullet}`, left + 14, contentWidth - 14, 13));
      y += 2;
    });
  }

  const skillLines = getRenderableSkillLines(data);
  if (skillLines.length) {
    writeSectionTitle("Skills");
    doc.setFont(pdfSerifFontFamily, "normal");
    doc.setFontSize(10);
    skillLines.forEach((line) => {
      writeWrapped(line.label ? `${line.label}: ${line.value}` : line.value, left, contentWidth, 13);
    });
    doc.setFont(pdfSerifFontFamily, "normal");
  }

  const buffer = doc.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
};

const buildBaseResumeData = (backendUser: BackendUserShape | null): ResumeData => ({
  name: backendUser?.displayName || "",
  phone: "",
  email: backendUser?.email || "",
  linkedin: backendUser?.linkedInUrl || "",
  github: backendUser?.githubUrl || "",
  education: (backendUser?.educationEntries || []).length
    ? (backendUser?.educationEntries || []).map((item) => ({
        school: item.college || "",
        location: item.location || "",
        degree: [item.degree, item.specialization].filter(Boolean).join(", "),
        date: item.endDate || "",
        grade: item.grade || ""
      }))
    : (backendUser?.education || []).map((item) => ({
        school: item,
        location: "",
        degree: "",
        date: "",
        grade: ""
      })),
  experience: (backendUser?.experience || []).map((item) => ({
    role: item.role || "",
    company: item.company || "",
    location: item.location || "",
    date: item.date || "",
    bullets: item.bullets || []
  })),
  projects: [],
  achievements: (backendUser?.achievements || []).map((item) => ({
    title: item.title || "",
    date: item.date || "",
    bullets: item.bullets || []
  })),
  skills: {
    languages: backendUser?.skillLanguages || [],
    frameworks: backendUser?.skillFrameworks || [],
    tools: backendUser?.skillTools || [],
    libraries: backendUser?.skillLibraries || []
  },
  skillSections: (backendUser?.skillSections || []).map((section) => ({
    title: section.title || "",
    skills: section.skills || []
  }))
});

const mapSelectedProjects = (projects: TailorInputOptions["projects"], selectedIds: string[]): Project[] => {
  const selectedSet = new Set(selectedIds);
  return projects
    .filter((project) => selectedSet.has(project.id))
    .map((project) => ({
      name: project.title,
      technologies: project.stack.join(", "),
      date: "",
      bullets: [project.description].filter(Boolean)
    }));
};

const mapSelectedExperiences = (experiences: TailorInputOptions["experiences"], selectedIds: string[]): Experience[] => {
  const selectedSet = new Set(selectedIds);
  return experiences
    .filter((experience) => selectedSet.has(experience.id))
    .map((experience) => ({
      role: experience.role,
      company: experience.company,
      location: experience.location,
      date: experience.date,
      bullets: experience.bullets
    }));
};

const mapSelectedAchievements = (achievements: TailorInputOptions["achievements"], selectedIds: string[]): Achievement[] => {
  const selectedSet = new Set(selectedIds);
  return achievements
    .filter((achievement) => selectedSet.has(achievement.id))
    .map((achievement) => ({
      title: achievement.title,
      date: achievement.date,
      bullets: achievement.bullets
    }));
};

const mapSelectedSkills = (sections: NonNullable<TailorInputOptions["skillSections"]>, selectedSkills: string[]) => {
  const selectedSet = new Set(selectedSkills);
  return sections.flatMap((section) => section.skills.filter((skill) => selectedSet.has(skill.label)).map((skill) => skill.label));
};

const groupBlockFragments = <T extends { id: string; role?: string; title?: string; company?: string; location?: string; date?: string; bullets?: string[] }>(items: T[]) => {
  const grouped: Array<{ id: string; head: T | null; bullets: string[] }> = [];

  for (const item of items) {
    const hasHeading = Boolean((item.role || item.title || item.company || item.location || item.date || "").trim());
    const normalizedBullets = Array.isArray(item.bullets) ? item.bullets.filter(Boolean) : [];
    const looksLikeBulletOnly = !hasHeading || ((item.role || item.title || "").trim().startsWith("-") && !item.company && !item.date);

    if (looksLikeBulletOnly && grouped.length) {
      grouped[grouped.length - 1].bullets.push(...normalizedBullets);
      if (!grouped[grouped.length - 1].head) {
        grouped[grouped.length - 1].head = item;
      }
      continue;
    }

    grouped.push({
      id: item.id,
      head: item,
      bullets: normalizedBullets
    });
  }

  return grouped.map((group) => ({
    id: group.id,
    head: group.head,
    bullets: uniqueStrings(group.bullets)
  }));
};

const AiTailor = () => {
  const { idToken, backendUser } = useAuth();
  const [jd, setJd] = useState("");
  const [resumes, setResumes] = useState<ResumeItem[]>([]);

  const [generatedPreview, setGeneratedPreview] = useState<ResumeData | null>(null);
  const [normalizedSkills, setNormalizedSkills] = useState<string[]>([]);
  const [recommendedSkills, setRecommendedSkills] = useState<string[]>([]);
  const [recommendedProjects, setRecommendedProjects] = useState<TailorLatexResponse["recommendedProjects"]>([]);
  const [recommendedExperiences, setRecommendedExperiences] = useState<TailorLatexResponse["recommendedExperiences"]>([]);
  const [recommendedAchievements, setRecommendedAchievements] = useState<TailorLatexResponse["recommendedAchievements"]>([]);
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [redactionSummary, setRedactionSummary] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState<TailorInputOptions["skills"]>([]);
  const [availableSkillSections, setAvailableSkillSections] = useState<NonNullable<TailorInputOptions["skillSections"]>>([]);
  const [availableProjects, setAvailableProjects] = useState<TailorInputOptions["projects"]>([]);
  const [availableExperiences, setAvailableExperiences] = useState<TailorInputOptions["experiences"]>([]);
  const [availableAchievements, setAvailableAchievements] = useState<TailorInputOptions["achievements"]>([]);
  const [approvedSkills, setApprovedSkills] = useState<string[]>([]);
  const [approvedProjectIds, setApprovedProjectIds] = useState<string[]>([]);
  const [approvedExperienceIds, setApprovedExperienceIds] = useState<string[]>([]);
  const [approvedAchievementIds, setApprovedAchievementIds] = useState<string[]>([]);
  const [jdResumeComment, setJdResumeComment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [loadingInputs, setLoadingInputs] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);

  const selectedResume = useMemo(() => resumes[0], [resumes]);
  const baseResumeData = useMemo(() => buildBaseResumeData((backendUser as BackendUserShape | null) || null), [backendUser]);
  const groupedAvailableExperiences = useMemo(() => groupBlockFragments(availableExperiences), [availableExperiences]);
  const groupedAvailableAchievements = useMemo(() => groupBlockFragments(availableAchievements), [availableAchievements]);
  const groupedRecommendedExperiences = useMemo(() => groupBlockFragments(recommendedExperiences), [recommendedExperiences]);
  const groupedRecommendedAchievements = useMemo(() => groupBlockFragments(recommendedAchievements), [recommendedAchievements]);

  const fetchResumes = useCallback(async () => {
    if (!idToken) {
      setLoadingResumes(false);
      setResumes([]);
      return;
    }

    try {
      const response = await apiRequest<{ resumes: ResumeItem[] }>("/resumes", { token: idToken });
      setResumes(response.data.resumes);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load resumes");
    } finally {
      setLoadingResumes(false);
    }
  }, [idToken]);

  const fetchTailorInputs = useCallback(async (resumeId: string, jobDescription: string) => {
    if (!idToken || !resumeId) {
      setAvailableSkills([]);
      setAvailableSkillSections([]);
      setAvailableProjects([]);
      setAvailableExperiences([]);
      setAvailableAchievements([]);
      setApprovedSkills([]);
      setApprovedProjectIds([]);
      setApprovedExperienceIds([]);
      setApprovedAchievementIds([]);
      setJdResumeComment([]);
      return;
    }

    setLoadingInputs(true);
    try {
      const response = await apiRequest<TailorInputOptions>(
        `/ai/tailor-inputs?resumeId=${resumeId}&jobDescription=${encodeURIComponent(jobDescription || "")}`,
        {
        token: idToken
        }
      );
      const skills = response.data.skills || [];
      const skillSections = response.data.skillSections || [];
      const projects = response.data.projects || [];
      const experiences = response.data.experiences || [];
      const achievements = response.data.achievements || [];
      const allSectionSkills = uniqueStrings(skillSections.flatMap((section) => section.skills.map((skill) => skill.label)));
      const recommendedSectionSkills = uniqueStrings(
        skillSections.flatMap((section) => section.skills.filter((skill) => (skill.relevanceScore || 0) > 0).map((skill) => skill.label))
      );
      setAvailableSkills(skills);
      setAvailableSkillSections(skillSections);
      setAvailableProjects(projects);
      setAvailableExperiences(experiences);
      setAvailableAchievements(achievements);
      setApprovedSkills((recommendedSectionSkills.length ? recommendedSectionSkills : allSectionSkills).slice(0, 20));
      setApprovedProjectIds(projects.filter((item) => (item.relevanceScore || 0) > 0).slice(0, 3).map((item) => item.id));
      setApprovedExperienceIds(experiences.filter((item) => (item.relevanceScore || 0) > 0).slice(0, 3).map((item) => item.id));
      setApprovedAchievementIds(achievements.filter((item) => (item.relevanceScore || 0) > 0).slice(0, 3).map((item) => item.id));
      setJdResumeComment(response.data.jdResumeComment || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load saved items");
      setAvailableSkills([]);
      setAvailableSkillSections([]);
      setAvailableProjects([]);
      setAvailableExperiences([]);
      setAvailableAchievements([]);
      setApprovedSkills([]);
      setApprovedProjectIds([]);
      setApprovedExperienceIds([]);
      setApprovedAchievementIds([]);
      setJdResumeComment([]);
    } finally {
      setLoadingInputs(false);
    }
  }, [idToken]);

  useEffect(() => {
    void fetchResumes();
  }, [fetchResumes]);

  const clearGeneratedState = () => {
    setGeneratedPreview(null);
    setNormalizedSkills([]);
    setRecommendedSkills([]);
    setRecommendedProjects([]);
    setRecommendedExperiences([]);
    setRecommendedAchievements([]);
    setExtractedUrls([]);
    setRedactionSummary([]);
    setJdResumeComment([]);
  };

  const handleAnalyze = async () => {
    if (!idToken) {
      toast.error("Sign in before analyzing saved info.");
      return;
    }

    if (!jd.trim()) {
      toast.error("Please paste a job description first.");
      return;
    }

    if (!selectedResume) {
      toast.error("Please select a resume first.");
      return;
    }

    setLoadingInputs(true);
    try {
      await fetchTailorInputs(selectedResume._id, jd);
      toast.success("Saved items ranked for this JD. Unselect anything you do not want.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze saved items");
    } finally {
      setLoadingInputs(false);
    }
  };

  const handleGenerate = async () => {
    if (!idToken) {
      toast.error("Sign in before generating a tailored resume.");
      return;
    }

    if (!jd.trim()) {
      toast.error("Please paste a job description first.");
      return;
    }

    if (!selectedResume) {
      toast.error("Please select a resume first.");
      return;
    }

    setLoading(true);

    try {
      const selectedProjectItems = mapSelectedProjects(availableProjects, approvedProjectIds);
      const selectedExperienceItems = mapSelectedExperiences(availableExperiences, approvedExperienceIds);
      const selectedAchievementItems = mapSelectedAchievements(availableAchievements, approvedAchievementIds);
      const selectedSkillItems = mapSelectedSkills(availableSkillSections, approvedSkills);

      const nextPreview: ResumeData = {
        ...baseResumeData,
        experience: selectedExperienceItems.length ? selectedExperienceItems : baseResumeData.experience,
        projects: selectedProjectItems.length ? selectedProjectItems : baseResumeData.projects,
        achievements: selectedAchievementItems.length ? selectedAchievementItems : baseResumeData.achievements,
        skills: {
          languages: selectedSkillItems.length ? selectedSkillItems : baseResumeData.skills?.languages || [],
          frameworks: baseResumeData.skills?.frameworks || [],
          tools: baseResumeData.skills?.tools || [],
          libraries: baseResumeData.skills?.libraries || []
        },
        skillSections: baseResumeData.skillSections
      };

      setGeneratedPreview(nextPreview);
      setRecommendedSkills(uniqueStrings(selectedSkillItems));
      setRecommendedProjects(availableProjects.filter((project) => approvedProjectIds.includes(project.id)));
      setRecommendedExperiences(availableExperiences.filter((experience) => approvedExperienceIds.includes(experience.id)));
      setRecommendedAchievements(availableAchievements.filter((achievement) => approvedAchievementIds.includes(achievement.id)));
      setJdResumeComment([
        "Saved profile fields were kept intact.",
        "Only the selected AI-approved skills, projects, experience, and achievements were merged into the preview.",
        "Generate Preview now uses the JakeResumePreview pipeline instead of LaTeX/PDF rendering.",
        "You can still unselect or select any saved item before previewing.",
        "Education and personal info are pulled from your saved profile as-is."
      ]);
      toast.success("Preview generated from saved data and selected AI items.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate preview");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFinalResume = async () => {
    if (!idToken || !generatedPreview) {
      return;
    }

    setSavingFinal(true);
    try {
      const sectionsCount = [
        generatedPreview.education?.length ? 1 : 0,
        generatedPreview.experience?.length ? 1 : 0,
        generatedPreview.projects?.length ? 1 : 0,
        generatedPreview.achievements?.length ? 1 : 0,
        (generatedPreview.skills?.languages?.length || generatedPreview.skills?.frameworks?.length || generatedPreview.skills?.tools?.length || generatedPreview.skills?.libraries?.length) ? 1 : 0
      ].reduce((sum, value) => sum + value, 0);

      const titleBase = generatedPreview.name?.trim() || backendUser?.displayName?.trim() || "Candidate";
      const title = `${titleBase} - AI Tailored Jake Resume`;

      const pdfBlob = await generateResumePdfBlob(generatedPreview);
      const pdfFile = new File([pdfBlob], `${title}.pdf`, { type: "application/pdf" });
      const formData = new FormData();
      formData.append("title", title);
      formData.append("sections", String(Math.max(sectionsCount, 1)));
      formData.append("resumeFile", pdfFile);

      await apiRequest<ResumeSaveResponse>("/resumes", {
        method: "POST",
        token: idToken,
        body: formData
      });

      toast.success("Final tailored resume saved as PDF. It is now visible in Resumes.");
      await fetchResumes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save final resume");
    } finally {
      setSavingFinal(false);
    }
  };

  const isGenerated = Boolean(generatedPreview);

  const toggleSkill = (skill: string) => {
    setApprovedSkills((current) =>
      current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill]
    );
  };

  const toggleProject = (projectId: string) => {
    setApprovedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((item) => item !== projectId)
        : [...current, projectId]
    );
  };

  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">AI Resume Tailor</h1>
        <p className="text-muted-foreground mb-8">
          Saved profile data is combined with your selected AI recommendations and rendered through the Jake preview pipeline.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="rounded-xl border border-border/50 bg-card/40 p-5">
            <h3 className="font-semibold text-foreground mb-1">Job Description</h3>
            <p className="text-xs text-muted-foreground mb-4">Paste the full JD below</p>
            <Textarea
              placeholder="We are looking for a Senior Frontend Developer with experience in React, TypeScript..."
              className="min-h-[200px] bg-background/50 border-border/50 resize-none mb-4"
              value={jd}
              onChange={(e) => {
                setJd(e.target.value);
                clearGeneratedState();
              }}
            />
            <div className="flex items-center gap-3">
              <div className="flex-1 h-9 rounded-md border border-border/50 bg-background/50 px-3 text-sm text-foreground flex items-center">
                {loadingResumes
                  ? "Loading latest resume..."
                  : selectedResume
                    ? `Using latest resume: ${selectedResume.title}`
                    : "No resume available"}
              </div>
              <Button
                variant="outline"
                onClick={handleAnalyze}
                disabled={!jd.trim() || loadingInputs || loadingResumes || resumes.length === 0}
              >
                {loadingInputs ? "Analyzing..." : "Analyze Saved Info"}
              </Button>
              <Button
                variant="hero"
                onClick={handleGenerate}
                disabled={!jd.trim() || loading || loadingResumes || loadingInputs || resumes.length === 0}
              >
                <Sparkles className="h-4 w-4 mr-2" /> {loading ? "Generating..." : "Generate Preview"}
              </Button>
            </div>

            <div className="mt-4 space-y-3 rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-xs text-muted-foreground">
                Saved info ranked by JD. Unselect anything you do not want in the final resume.
              </p>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Skills</p>
                  <p className="text-[11px] text-muted-foreground">{approvedSkills.length} selected</p>
                </div>
                <div className="space-y-2">
                  {loadingInputs ? (
                    <Badge variant="secondary" className="text-xs">Loading...</Badge>
                  ) : availableSkillSections.length ? (
                    availableSkillSections.map((section) => (
                      <div key={section.id} className="rounded-md border border-border/40 bg-background/40 p-2">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">{section.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {section.skills.map((skill) => {
                            const active = approvedSkills.includes(skill.label);
                            const recommended = (skill.relevanceScore || 0) > 0;
                            return (
                              <button
                                key={skill.id}
                                type="button"
                                onClick={() => toggleSkill(skill.label)}
                                className={`text-xs px-2 py-1 rounded border ${active ? "bg-primary/15 border-primary/40 text-primary" : "bg-background/60 border-border/50 text-muted-foreground"}`}
                                title={recommended ? "AI Recommended" : "Manual Select"}
                              >
                                {skill.label}
                                {recommended ? " *" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <Badge variant="secondary" className="text-xs">No saved skills found</Badge>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Projects</p>
                  <p className="text-[11px] text-muted-foreground">{approvedProjectIds.length} selected</p>
                </div>
                <div className="space-y-2">
                  {availableProjects.length ? (
                    availableProjects.map((project) => {
                      const active = approvedProjectIds.includes(project.id);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => toggleProject(project.id)}
                          className={`w-full text-left rounded-md border p-2 ${active ? "bg-primary/10 border-primary/40" : "bg-background/60 border-border/50"}`}
                        >
                          <p className="text-sm font-medium text-foreground">{project.title}{(project.relevanceScore || 0) > 0 ? " *" : ""}</p>
                          {project.stack.length ? (
                            <p className="text-[11px] text-muted-foreground">{project.stack.join(", ")}</p>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">No saved projects found</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Experience</p>
                  <p className="text-[11px] text-muted-foreground">{approvedExperienceIds.length} selected</p>
                </div>
                <div className="space-y-2">
                  {groupedAvailableExperiences.length ? (
                    groupedAvailableExperiences.map((experienceGroup) => {
                      const experience = experienceGroup.head;
                      const active = experience ? approvedExperienceIds.includes(experience.id) : false;
                      return (
                        <button
                          key={experienceGroup.id}
                          type="button"
                          onClick={() => {
                            if (!experience) {
                              return;
                            }

                            setApprovedExperienceIds((current) =>
                              current.includes(experience.id)
                                ? current.filter((item) => item !== experience.id)
                                : [...current, experience.id]
                            );
                          }}
                          className={`w-full text-left rounded-md border p-2 ${active ? "bg-primary/10 border-primary/40" : "bg-background/60 border-border/50"}`}
                        >
                          <p className="text-sm font-medium text-foreground">{experience?.role || experience?.company || "Experience item"}{(experience?.relevanceScore || 0) > 0 ? " *" : ""}</p>
                          <p className="text-[11px] text-muted-foreground">{[experience?.company, experience?.location, experience?.date].filter(Boolean).join(" • ")}</p>
                          {experienceGroup.bullets.length > 0 ? (
                            <ul className="list-disc ml-4 mt-1 space-y-1">
                              {experienceGroup.bullets.slice(0, 4).map((bullet, index) => (
                                <li key={`${experienceGroup.id}-bullet-${index}`} className="text-[11px] text-foreground/90">
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">No saved experience found</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">Achievements</p>
                  <p className="text-[11px] text-muted-foreground">{approvedAchievementIds.length} selected</p>
                </div>
                <div className="space-y-2">
                  {groupedAvailableAchievements.length ? (
                    groupedAvailableAchievements.map((achievementGroup) => {
                      const achievement = achievementGroup.head;
                      const active = achievement ? approvedAchievementIds.includes(achievement.id) : false;
                      return (
                        <button
                          key={achievementGroup.id}
                          type="button"
                          onClick={() => {
                            if (!achievement) {
                              return;
                            }

                            setApprovedAchievementIds((current) =>
                              current.includes(achievement.id)
                                ? current.filter((item) => item !== achievement.id)
                                : [...current, achievement.id]
                            );
                          }}
                          className={`w-full text-left rounded-md border p-2 ${active ? "bg-primary/10 border-primary/40" : "bg-background/60 border-border/50"}`}
                        >
                          <p className="text-sm font-medium text-foreground">{achievement?.title || "Achievement item"}{(achievement?.relevanceScore || 0) > 0 ? " *" : ""}</p>
                          <p className="text-[11px] text-muted-foreground">{achievement?.date || "No date"}</p>
                          {achievementGroup.bullets.length > 0 ? (
                            <ul className="list-disc ml-4 mt-1 space-y-1">
                              {achievementGroup.bullets.slice(0, 4).map((bullet, index) => (
                                <li key={`${achievementGroup.id}-bullet-${index}`} className="text-[11px] text-foreground/90">
                                  {bullet}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">No saved achievements found</p>
                  )}
                </div>
              </div>

              {jdResumeComment.length > 0 ? (
                <div className="rounded-md border border-border/40 bg-background/40 p-2">
                  <p className="text-xs text-muted-foreground mb-1">AI JD vs Resume Comment</p>
                  <ul className="list-disc ml-4 space-y-1">
                    {jdResumeComment.slice(0, 5).map((line, index) => (
                      <li key={`jd-comment-${index}`} className="text-xs text-foreground/90">{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          {isGenerated ? (
            <div className="rounded-xl border border-border/50 bg-card/40 p-5 mt-4 space-y-3">
              <h3 className="font-semibold text-foreground">JD Recommendations Applied</h3>
              <p className="text-xs text-muted-foreground">
                AI Tailor used JD-relevant skills and your top 3 matching projects to prepare this final edited resume.
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Recommended Skills (JD Match)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recommendedSkills.length > 0 ? (
                      recommendedSkills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        No explicit JD skill recommendation detected
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Top 3 JD-Matched Projects</p>
                  <div className="space-y-2">
                    {recommendedProjects.length > 0 ? (
                      recommendedProjects.map((project) => (
                        <div key={project.id} className="rounded-md border border-border/40 bg-background/40 p-2">
                          <p className="text-sm font-medium text-foreground">{project.title}</p>
                          {project.stack.length > 0 ? (
                            <p className="text-[11px] text-muted-foreground">{project.stack.join(", ")}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No saved projects found to rank.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">JD-Matched Experience Blocks</p>
                  <div className="space-y-2">
                    {recommendedExperiences.length > 0 ? (
                      groupedRecommendedExperiences.slice(0, 3).map((experienceGroup) => (
                          <div key={experienceGroup.id} className="rounded-md border border-border/40 bg-background/40 p-2">
                            <p className="text-sm font-medium text-foreground">{experienceGroup.head?.role || experienceGroup.head?.company || "Experience item"}</p>
                            <p className="text-[11px] text-muted-foreground">{[experienceGroup.head?.company, experienceGroup.head?.location, experienceGroup.head?.date].filter(Boolean).join(" • ")}</p>
                            {experienceGroup.bullets.length > 0 ? (
                            <ul className="list-disc ml-4 mt-1 space-y-1">
                                {experienceGroup.bullets.slice(0, 3).map((bullet, index) => (
                                  <li key={`${experienceGroup.id}-bullet-${index}`} className="text-[11px] text-foreground/90">{bullet}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No experience block matched strongly enough to recommend.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">JD-Matched Achievement Blocks</p>
                  <div className="space-y-2">
                    {recommendedAchievements.length > 0 ? (
                      groupedRecommendedAchievements.slice(0, 3).map((achievementGroup) => (
                          <div key={achievementGroup.id} className="rounded-md border border-border/40 bg-background/40 p-2">
                            <p className="text-sm font-medium text-foreground">{achievementGroup.head?.title || "Achievement item"}</p>
                            <p className="text-[11px] text-muted-foreground">{achievementGroup.head?.date || "No date"}</p>
                            {achievementGroup.bullets.length > 0 ? (
                            <ul className="list-disc ml-4 mt-1 space-y-1">
                                {achievementGroup.bullets.slice(0, 3).map((bullet, index) => (
                                  <li key={`${achievementGroup.id}-bullet-${index}`} className="text-[11px] text-foreground/90">{bullet}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No achievement block matched strongly enough to recommend.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="rounded-xl border border-border/50 bg-card/40 p-5 min-h-[340px] flex flex-col">
            {isGenerated ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Final Edited Resume Ready</h3>
                </div>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    {selectedResume?.title || "Resume"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {approvedSkills.length} skills selected
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {approvedProjectIds.length} projects selected
                  </Badge>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Preview Snapshot</p>
                  <div className="rounded-lg bg-white border border-border/30 p-3 max-h-[560px] overflow-auto">
                    <JakeResumePreview data={generatedPreview || baseResumeData} />
                  </div>
                </div>

                <div className="rounded-lg bg-background/50 border border-border/30 p-3 mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Selection Summary</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-xs">{approvedSkills.length} skills</Badge>
                    <Badge variant="secondary" className="text-xs">{approvedProjectIds.length} projects</Badge>
                    <Badge variant="secondary" className="text-xs">{approvedExperienceIds.length} experience</Badge>
                    <Badge variant="secondary" className="text-xs">{approvedAchievementIds.length} achievements</Badge>
                  </div>
                </div>

                {jdResumeComment.length > 0 ? (
                  <div className="rounded-lg bg-background/50 border border-border/30 p-3 mb-4">
                    <p className="text-xs text-muted-foreground mb-2">JD vs Resume Comment</p>
                    <ul className="list-disc ml-4 space-y-1">
                      {jdResumeComment.slice(0, 5).map((line, index) => (
                        <li key={`preview-comment-${index}`} className="text-xs text-foreground/90">{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Button variant="hero-outline" size="sm" onClick={handleSaveFinalResume} disabled={savingFinal}>
                    {savingFinal ? "Saving..." : "Save Final"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Generate to preview your resume in Jake format</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    This uses saved profile data plus your selected AI recommendations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AiTailor;
