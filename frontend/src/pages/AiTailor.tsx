import { motion } from "framer-motion";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  createdAt: string;
  updatedAt: string;
};

type ResumeSaveResponse = {
  resume: ResumeItem;
};

type BackendUserShape = {
  displayName?: string;
  phone?: string;
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

type JdRequirements = {
  primaryTechStack: string[];
  secondarySkills: string[];
  coreResponsibilities: string[];
  atsKeywords: string[];
  seniority: string;
  roleTitle: string;
};

type MatchInsights = {
  currentMatchPercent: number;
  projectedMatchPercent: number;
  breakdown: {
    current: {
      skills: number;
      projects: number;
      experience: number;
      achievements: number;
    };
    projected: {
      skills: number;
      projects: number;
      experience: number;
      achievements: number;
    };
  };
  matchedKeywords: string[];
  missingKeywords: string[];
  missingSkills: string[];
  existingProjectUpgradeSuggestions: {
    projectId: string;
    projectTitle: string;
    suggestions: string[];
  }[];
  newProjectSuggestions: {
    title: string;
    focusSkills: string[];
    rationale: string;
  }[];
  gapSummary: string[];
};

type TailorTwoStageResponse = {
  tailoredJson: {
    optimizedSkills: {
      primary: string[];
      secondary: string[];
      additional: string[];
      removed: string[];
      finalOrdered: string[];
    };
    optimizedProjects: {
      id: string;
      title: string;
      description: string;
      stack: string[];
      date: string;
      githubUrl: string;
      demoUrl: string;
      bullets: string[];
    }[];
    selectedExperiences: {
      id: string;
      role: string;
      company: string;
      location: string;
      date: string;
      bullets: string[];
    }[];
    selectedAchievements: {
      id: string;
      title: string;
      date: string;
      bullets: string[];
    }[];
    summaryNotes: string[];
    matchInsights?: MatchInsights;
  };
  jdAnalysisUsed: JdRequirements;
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

const cleanResumeText = (value: string) =>
  value
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/^\s*(situation|task|action|result)\s*:\s*/i, "")
    .replace(/^\s*(s|t|a|r)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

const compactBullets = (items: string[], maxCount = 3) =>
  uniqueStrings(items.map(cleanResumeText).filter(Boolean)).slice(0, maxCount);

const compactProjectTechnologies = (technologies: string) =>
  uniqueStrings(
    technologies
      .split(/[,/|]/)
      .map((item) => cleanResumeText(item))
      .filter(Boolean)
  ).slice(0, 4).join(", ");

const compactProjectTitle = (title: string) => cleanResumeText(title).replace(/\s*\|\s*$/, "");

const compactProjectDescription = (description: string) => cleanResumeText(description).replace(/\.$/, "");

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
    y += 10;
    y = ensurePdfY(doc, y);
    doc.setFont(pdfSerifFontFamily, "bold");
    doc.setFontSize(11.5);
    doc.text(title.toUpperCase(), left, y);
    y += 8;
    y = ensurePdfY(doc, y);
    doc.setLineWidth(0.8);
    doc.line(left, y, left + contentWidth, y);
    y += 12;
    doc.setFont(pdfSerifFontFamily, "normal");
    doc.setFontSize(10);
  };

  doc.setFont(pdfSerifFontFamily, "bold");
  doc.setFontSize(22);
  y = ensurePdfY(doc, y);
  doc.text(data.name || "Candidate", centerX, y, { align: "center" });
  y += 22;

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
      writeLeftRight(item.school || "", item.location || "", 13);

      doc.setFont(pdfSerifFontFamily, "italic");
      writeLeftRight([item.degree, item.grade].filter(Boolean).join(" - "), item.date || "", 13);

      doc.setFont(pdfSerifFontFamily, "normal");
      y += 2;
    });
  }

  if (data.experience?.length) {
    writeSectionTitle("Experience");
    data.experience.forEach((item) => {
      doc.setFont(pdfSerifFontFamily, "bold");
      doc.setFontSize(10.5);
      writeLeftRight(item.role || "", item.date || "", 13);

      doc.setFont(pdfSerifFontFamily, "italic");
      doc.setFontSize(10);
      writeLeftRight(item.company || "", item.location || "", 12);

      doc.setFont(pdfSerifFontFamily, "normal");
      doc.setFontSize(9.7);
      item.bullets.forEach((bullet) => writeWrapped(`- ${bullet}`, left + 14, contentWidth - 14, 12));
      y += 1;
    });
  }

  if (data.projects?.length) {
    writeSectionTitle("Projects");
    data.projects.forEach((item) => {
      doc.setFont(pdfSerifFontFamily, "bold");
      doc.setFontSize(10.5);
      writeLeftRight(item.name || "", item.date || "", 13);

      if (item.technologies) {
        doc.setFont(pdfSerifFontFamily, "italic");
        doc.setFontSize(10);
        writeWrapped(item.technologies, left, contentWidth, 11);
      }

      doc.setFont(pdfSerifFontFamily, "normal");
      doc.setFontSize(9.7);
      item.bullets.forEach((bullet) => writeWrapped(`- ${bullet}`, left + 14, contentWidth - 14, 12));
      y += 2;
    });
  }

  if (data.achievements?.length) {
    writeSectionTitle("Achievements");
    data.achievements.forEach((item) => {
      doc.setFont(pdfSerifFontFamily, "bold");
      doc.setFontSize(10.5);
      writeLeftRight(item.title || "", item.date || "", 13);
      doc.setFont(pdfSerifFontFamily, "normal");
      doc.setFontSize(9.7);
      item.bullets.forEach((bullet) => writeWrapped(`- ${bullet}`, left + 14, contentWidth - 14, 12));
      y += 1;
    });
  }

  const skillLines = getRenderableSkillLines(data);
  if (skillLines.length) {
    writeSectionTitle("Skills");
    doc.setFont(pdfSerifFontFamily, "normal");
    doc.setFontSize(9.7);
    skillLines.forEach((line) => {
      writeWrapped(line.label ? `${line.label}: ${line.value}` : line.value, left, contentWidth, 12);
    });
    doc.setFont(pdfSerifFontFamily, "normal");
  }

  const buffer = doc.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
};

const buildBaseResumeData = (backendUser: BackendUserShape | null): ResumeData => ({
  name: backendUser?.displayName || "",
  phone: backendUser?.phone || "",
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
  const [recommendedProjects, setRecommendedProjects] = useState<TailorInputOptions["projects"]>([]);
  const [recommendedExperiences, setRecommendedExperiences] = useState<TailorInputOptions["experiences"]>([]);
  const [recommendedAchievements, setRecommendedAchievements] = useState<TailorInputOptions["achievements"]>([]);
  const [matchInsights, setMatchInsights] = useState<MatchInsights | null>(null);
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [redactionSummary, setRedactionSummary] = useState<string[]>([]);
  const [jdResumeComment, setJdResumeComment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [savingFinal, setSavingFinal] = useState(false);
  const [showSaveTitleDialog, setShowSaveTitleDialog] = useState(false);
  const [saveResumeTitle, setSaveResumeTitle] = useState("");

  const selectedResume = useMemo(() => resumes[0], [resumes]);
  const baseResumeData = useMemo(() => buildBaseResumeData((backendUser as BackendUserShape | null) || null), [backendUser]);
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
    setMatchInsights(null);
    setExtractedUrls([]);
    setRedactionSummary([]);
    setJdResumeComment([]);
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

    setLoading(true);

    try {
      const response = await apiRequest<TailorTwoStageResponse>("/ai/tailor-two-stage", {
        method: "POST",
        token: idToken,
        body: {
          jobDescription: jd,
          ...(selectedResume ? { resumeId: selectedResume._id } : {})
        }
      });

      const tailored = response.data.tailoredJson;
      const insights = tailored.matchInsights || null;
      const optimizedSkillsOrdered = uniqueStrings(tailored.optimizedSkills?.finalOrdered || []);
      const optimizedProjects = tailored.optimizedProjects || [];
      const optimizedExperiences = tailored.selectedExperiences || [];
      const optimizedAchievements = tailored.selectedAchievements || [];

      const selectedSkillItems = optimizedSkillsOrdered.length
        ? optimizedSkillsOrdered
        : baseResumeData.skills?.languages || [];

      const selectedProjectItems: Project[] = optimizedProjects.map((project) => ({
        name: compactProjectTitle(project.title),
        technologies: compactProjectTechnologies((project.stack || []).join(", ")),
        date: project.date || "",
        bullets: compactBullets(project.bullets && project.bullets.length ? project.bullets : [project.description], 3)
      }));

      const selectedExperienceItems: Experience[] = optimizedExperiences.map((experience) => ({
        role: experience.role,
        company: experience.company,
        location: experience.location,
        date: experience.date,
        bullets: compactBullets(experience.bullets || [], 3)
      }));

      const selectedAchievementItems: Achievement[] = optimizedAchievements.map((achievement) => ({
        title: achievement.title,
        date: achievement.date,
        bullets: compactBullets(achievement.bullets || [], 3)
      }));

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
      setMatchInsights(insights);
      setNormalizedSkills(optimizedSkillsOrdered);
      setRecommendedSkills(uniqueStrings(selectedSkillItems));
      setRecommendedProjects(
        optimizedProjects.map((project) => ({
          id: project.id,
          title: compactProjectTitle(project.title),
          description: compactProjectDescription(project.description),
          stack: uniqueStrings((project.stack || []).map(cleanResumeText)),
          githubUrl: project.githubUrl || "",
          demoUrl: project.demoUrl || "",
          relevanceScore: 1
        }))
      );
      setRecommendedExperiences(
        optimizedExperiences.map((experience) => ({
          ...experience,
          bullets: compactBullets(experience.bullets || [], 3),
          relevanceScore: 1
        }))
      );
      setRecommendedAchievements(
        optimizedAchievements.map((achievement) => ({
          ...achievement,
          bullets: compactBullets(achievement.bullets || [], 3),
          relevanceScore: 1
        }))
      );
      setJdResumeComment(
        [
          ...(insights?.gapSummary || []),
          ...(tailored.summaryNotes || [])
        ].length
          ? [
              ...(insights?.gapSummary || []),
              ...(tailored.summaryNotes || [])
            ]
          : ["AI transformer auto-optimized projects and skills against JD requirements."]
      );
      toast.success("Final preview generated through Jake pipeline using auto-tailored data.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate preview");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFinalResume = async () => {
    if (!idToken || !generatedPreview || !saveResumeTitle.trim()) {
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

      const title = saveResumeTitle.trim();

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
      setShowSaveTitleDialog(false);
      setSaveResumeTitle("");
      await fetchResumes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save final resume");
    } finally {
      setSavingFinal(false);
    }
  };

  const openSaveTitleDialog = () => {
    const titleBase = generatedPreview?.name?.trim() || backendUser?.displayName?.trim() || "Candidate";
    setSaveResumeTitle(`${titleBase} - AI Tailored Jake Resume`);
    setShowSaveTitleDialog(true);
  };

  const isGenerated = Boolean(generatedPreview);

  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">AI Resume Tailor</h1>
        <p className="text-muted-foreground mb-8">
          One-click tailoring: JD + your master profile data are auto-processed and rendered through the Jake preview pipeline.
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
                    : "No resume found - using master profile data"}
              </div>
              <Button
                variant="hero"
                onClick={handleGenerate}
                disabled={!jd.trim() || loading || loadingResumes}
              >
                <Sparkles className="h-4 w-4 mr-2" /> {loading ? "Generating..." : "Generate Final Preview"}
              </Button>
            </div>

            <div className="mt-4 rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-xs text-muted-foreground">
                No analyze or manual selection step is required. Click Generate Final Preview and AI will auto-analyze JD,
                auto-rank your saved master data, tailor it, and render final preview.
              </p>
            </div>
          </div>

          {isGenerated ? (
            <div className="rounded-xl border border-border/50 bg-card/40 p-5 mt-4 space-y-3">
              <h3 className="font-semibold text-foreground">JD Recommendations Applied</h3>
              <p className="text-xs text-muted-foreground">
                AI Tailor used JD-relevant skills and your top matching projects to prepare this final edited resume.
              </p>
              <div className="space-y-3">
                {matchInsights ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">JD Match Score</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs">Current: {matchInsights.currentMatchPercent}%</Badge>
                      <Badge variant="secondary" className="text-xs">Projected After Suggestions: {matchInsights.projectedMatchPercent}%</Badge>
                    </div>
                  </div>
                ) : null}

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
                  <p className="text-xs text-muted-foreground mb-2">Top JD-Matched Projects</p>
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

                {matchInsights?.missingSkills?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Missing JD Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchInsights.missingSkills.slice(0, 10).map((skill) => (
                        <Badge key={`missing-skill-${skill}`} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {matchInsights?.existingProjectUpgradeSuggestions?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">How To Improve Existing Projects</p>
                    <div className="space-y-2">
                      {matchInsights.existingProjectUpgradeSuggestions.map((item) => (
                        <div key={`upgrade-${item.projectId}`} className="rounded-md border border-border/40 bg-background/40 p-2">
                          <p className="text-sm font-medium text-foreground">{item.projectTitle}</p>
                          <ul className="list-disc ml-4 mt-1 space-y-1">
                            {item.suggestions.slice(0, 3).map((line, idx) => (
                              <li key={`upgrade-line-${item.projectId}-${idx}`} className="text-xs text-foreground/90">{line}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {matchInsights?.newProjectSuggestions?.length ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Suggested New Projects For JD Fit</p>
                    <div className="space-y-2">
                      {matchInsights.newProjectSuggestions.map((item, idx) => (
                        <div key={`new-project-suggestion-${idx}`} className="rounded-md border border-border/40 bg-background/40 p-2">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{item.rationale}</p>
                          {item.focusSkills.length ? (
                            <p className="text-[11px] text-foreground/90 mt-1">Focus skills: {item.focusSkills.join(", ")}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                    {recommendedSkills.length} skills optimized
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {recommendedProjects.length} projects optimized
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
                    <Badge variant="secondary" className="text-xs">{recommendedSkills.length} skills</Badge>
                    <Badge variant="secondary" className="text-xs">{recommendedProjects.length} projects</Badge>
                    <Badge variant="secondary" className="text-xs">{recommendedExperiences.length} experience</Badge>
                    <Badge variant="secondary" className="text-xs">{recommendedAchievements.length} achievements</Badge>
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
                  <Button variant="hero-outline" size="sm" onClick={openSaveTitleDialog} disabled={savingFinal}>
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
                    This uses your saved profile data and auto-tailored AI recommendations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <Dialog
        open={showSaveTitleDialog}
        onOpenChange={(open) => {
          setShowSaveTitleDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Final Resume</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={saveResumeTitle}
              onChange={(event) => setSaveResumeTitle(event.target.value)}
              placeholder="Enter a title for this saved resume"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSaveFinalResume();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveTitleDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveFinalResume()} disabled={savingFinal || !saveResumeTitle.trim()}>
              {savingFinal ? "Saving..." : "Save Resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AiTailor;
