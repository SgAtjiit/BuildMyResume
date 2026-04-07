import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Eye, Trash2, Download, ChevronUp, Plus, Wand2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/use-auth";
import { apiRequest, getBackendOrigin } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AIDescriptionGeneratorDialog from "@/components/AIDescriptionGeneratorDialog";
import { AI_PROMPT_PRESETS } from "@/config/aiPromptPresets";
import JakeResumePreview, { type PreviewLayoutConfig } from "@/components/resume/JakeResumePreview";
import type { Achievement, Education, Experience, Project, ResumeData } from "@/components/resume/ResumeTypes";
import { getRenderableSkillLines } from "@/components/resume/skillFormat";
import jsPDF from "jspdf";

// ==========================================
// TYPES
// ==========================================
type ResumeItem = {
  _id: string; title: string; format: "PDF" | "DOCX" | "TXT" | "TEX" | "IMAGE"; sections: number; content: string; originalFileName?: string; filePath?: string; createdAt: string; updatedAt: string;
};
type ProjectSeed = {
  _id: string;
  title: string;
  description: string;
  stack: string[];
  date?: string;
  githubUrl?: string;
  demoUrl?: string;
  updatedAt: string;
};
type EducationRow = { school: string; location: string; degree: string; date: string; grade: string; };
type ExperienceRow = { role: string; company: string; location: string; date: string; bulletText: string; };
type ProjectRow = { name: string; technologies: string; githubUrl: string; demoUrl: string; bulletText: string; };
type AchievementRow = { title: string; date: string; bulletText: string; };
type LayoutMode = "COMPACT" | "EXHAUSTIVE";
type OptimizedLayout = { layout: LayoutMode; maxProjectBullets: number; skillFormat: "INLINE" | "GRID"; fontScaling: number; lineHeight: number; sectionGap: number; };
type GeneratorTarget =
  | { kind: "experience"; index: number }
  | { kind: "achievement"; index: number }
  | { kind: "project"; index: number }
  | null;

// ==========================================
// CONSTANTS & UTILS
// ==========================================
const emptySkillRow = "";
type SkillSectionRow = { title: string; skills: string[]; };
const defaultSkillSections = (): SkillSectionRow[] => [ { title: "Communication", skills: [emptySkillRow] }, { title: "Technical", skills: [emptySkillRow] }, { title: "Collaboration", skills: [emptySkillRow] }, { title: "Leadership", skills: [emptySkillRow] } ];

const ONE_PAGE_LINE_LIMIT = 52;
const PROJECT_BULLET_WRAP_WIDTH = 526;
const PROJECT_BULLET_FONT_SIZE = 10;

const parseBullets = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

// ==========================================
// PDF LOGIC (Preserved Exactly)
// ==========================================
const ensurePdfY = (doc: jsPDF, y: number) => { if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); return 36; } return y; };
const estimatePageLines = (data: ResumeData) => {
  const headingAndContact = 8;
  const professionalSummaryLines = data.professionalSummary?.trim() ? 3 : 0;
  const educationLines = (data.education ?? []).length * 4;
  const experienceLines = (data.experience ?? []).reduce((total, item) => total + 3 + (item.bullets?.length || 0), 0);
  const projectLines = (data.projects ?? []).reduce((total, item) => total + 2 + (item.bullets?.length || 0), 0);
  const achievementLines = (data.achievements ?? []).reduce((total, item) => total + 2 + (item.bullets?.length || 0), 0);
  const skillLines = getRenderableSkillLines(data).length * 1.2;
  return Math.ceil(headingAndContact + professionalSummaryLines + educationLines + experienceLines + projectLines + achievementLines + skillLines);
};

const estimatePageFill = (data: ResumeData) => Math.min(1, estimatePageLines(data) / ONE_PAGE_LINE_LIMIT);

const optimizeLayout = (data: ResumeData, options?: { forceExpanded?: boolean; stickyExpanded?: boolean }): OptimizedLayout => {
  const experienceCount = data.experience?.length ?? 0;
  const fillRatio = estimatePageFill(data);
  const shouldExpand = experienceCount === 0 || options?.forceExpanded || (options?.stickyExpanded && fillRatio < 0.9);

  if (!shouldExpand) return { layout: "COMPACT", maxProjectBullets: 3, skillFormat: "INLINE", fontScaling: 1, lineHeight: 1.16, sectionGap: 14 };
  return { layout: "EXHAUSTIVE", maxProjectBullets: 4, skillFormat: "INLINE", fontScaling: 1, lineHeight: 1.2, sectionGap: 16 };
};

const pdfSerifFontFamily = "NotoSerif";
let pdfFontLoadPromise: Promise<Record<string, string>> | null = null;

const arrayBufferToBinaryString = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer); let result = "";
  for (let i = 0; i < bytes.length; i += 0x8000) result += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return result;
};

const loadPdfSerifFontData = async () => {
  if (!pdfFontLoadPromise) {
    pdfFontLoadPromise = (async () => {
      const responses = await Promise.all([ fetch("/fonts/NotoSerif-Regular.ttf"), fetch("/fonts/NotoSerif-Bold.ttf"), fetch("/fonts/NotoSerif-Italic.ttf"), fetch("/fonts/NotoSerif-BoldItalic.ttf") ]);
      if (responses.some((r) => !r.ok)) throw new Error("Failed to load embedded serif font files");
      const buffers = await Promise.all(responses.map((r) => r.arrayBuffer()));
      return { regular: arrayBufferToBinaryString(buffers[0]), bold: arrayBufferToBinaryString(buffers[1]), italic: arrayBufferToBinaryString(buffers[2]), bolditalic: arrayBufferToBinaryString(buffers[3]) };
    })();
  }
  return pdfFontLoadPromise;
};

const ensurePdfSerifFont = async (doc: jsPDF) => {
  const fontList = doc.getFontList() as Record<string, string[]>;
  if (fontList[pdfSerifFontFamily]) return;
  const fontData = await loadPdfSerifFontData();
  const jsPdfDoc = doc as jsPDF & {
    addFileToVFS: (fileName: string, fileData: string) => void;
    addFont: (fileName: string, fontName: string, fontStyle: string) => void;
  };
  jsPdfDoc.addFileToVFS("NotoSerif-Regular.ttf", fontData.regular); jsPdfDoc.addFileToVFS("NotoSerif-Bold.ttf", fontData.bold); jsPdfDoc.addFileToVFS("NotoSerif-Italic.ttf", fontData.italic); jsPdfDoc.addFileToVFS("NotoSerif-BoldItalic.ttf", fontData.bolditalic);
  jsPdfDoc.addFont("NotoSerif-Regular.ttf", pdfSerifFontFamily, "normal"); jsPdfDoc.addFont("NotoSerif-Bold.ttf", pdfSerifFontFamily, "bold"); jsPdfDoc.addFont("NotoSerif-Italic.ttf", pdfSerifFontFamily, "italic"); jsPdfDoc.addFont("NotoSerif-BoldItalic.ttf", pdfSerifFontFamily, "bolditalic");
};

// ==========================================
// INITIAL STATES
// ==========================================
const initialResumeData: ResumeData = { name: "", phone: "", email: "", linkedin: "", github: "", professionalSummary: "", education: [], experience: [], projects: [], achievements: [], skillSections: [], skills: { languages: [], frameworks: [], tools: [], libraries: [] } };
const emptyEducationRow: EducationRow = { school: "", location: "", degree: "", date: "", grade: "" };
const emptyExperienceRow: ExperienceRow = { role: "", company: "", location: "", date: "", bulletText: "" };
const emptyProjectRow: ProjectRow = { name: "", technologies: "", githubUrl: "", demoUrl: "", bulletText: "" };
const emptyAchievementRow: AchievementRow = { title: "", date: "", bulletText: "" };

// ==========================================
// MAIN COMPONENT
// ==========================================
const Resumes = () => {
  const { idToken, backendUser } = useAuth();
  
  // Base State
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingAllResumes, setDeletingAllResumes] = useState(false);
  
  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [saveTitleMode, setSaveTitleMode] = useState<"upload" | "jake" | null>(null);
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);

  // Builder State
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState(0);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [savingBuilderResume, setSavingBuilderResume] = useState(false);
  const [projectSeeds, setProjectSeeds] = useState<ProjectSeed[]>([]);
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);

  const [educationRows, setEducationRows] = useState<EducationRow[]>([]);
  const [experienceRows, setExperienceRows] = useState<ExperienceRow[]>([]);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [achievementRows, setAchievementRows] = useState<AchievementRow[]>([]);
  const [skillSections, setSkillSections] = useState<SkillSectionRow[]>(defaultSkillSections());
  const [professionalSummaryInput, setProfessionalSummaryInput] = useState("");
  
  // Builder Logic State
  const [forceExpandedLayout, setForceExpandedLayout] = useState(false);
  const [stickyExpandedLayout, setStickyExpandedLayout] = useState(false);
  const [skippedExperience, setSkippedExperience] = useState(false);
  const [skippedAchievements, setSkippedAchievements] = useState(false);
  const [projectAtsMode, setProjectAtsMode] = useState<Record<number, boolean>>({});
  const [extendingBulletKey, setExtendingBulletKey] = useState<string | null>(null);
  const [extendingProjectIndex, setExtendingProjectIndex] = useState<number | null>(null);
  const [generatorTarget, setGeneratorTarget] = useState<GeneratorTarget>(null);

  // Computed Values
  const hasExperienceContent = useMemo(() => experienceRows.some((row) => row.role.trim() || row.company.trim() || parseBullets(row.bulletText).length > 0), [experienceRows]);
  const hasAchievementContent = useMemo(() => achievementRows.some((row) => row.title.trim() || parseBullets(row.bulletText).length > 0), [achievementRows]);
  const showProfessionalSummary = !hasExperienceContent && !hasAchievementContent;

  const stepIndexes = useMemo(() => ({ professionalSummary: showProfessionalSummary ? 1 : -1, education: showProfessionalSummary ? 2 : 1, experience: showProfessionalSummary ? 3 : 2, achievements: showProfessionalSummary ? 4 : 3, skills: showProfessionalSummary ? 5 : 4, projects: showProfessionalSummary ? 6 : 5, preview: showProfessionalSummary ? 7 : 6 }), [showProfessionalSummary]);
  const stepTitles = useMemo(() => [ "Basic Contact", ...(showProfessionalSummary ? ["Professional Summary"] : []), "Education (Optional)", "Experience (Optional)", "Achievements (Optional)", "Technical Skills (Optional)", "Projects (Optional)", "Preview and Save" ], [showProfessionalSummary]);

  // Data Fetching
  const fetchResumes = useCallback(async () => {
    if (!idToken) { setResumes([]); setLoading(false); return; }
    try {
      const response = await apiRequest<{ resumes: ResumeItem[] }>("/resumes", { token: idToken });
      setResumes(response.data.resumes);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to load resumes"); } 
    finally { setLoading(false); }
  }, [idToken]);

  useEffect(() => { void fetchResumes(); }, [fetchResumes]);

  // Upload Handlers
  const handleFileSelected = (file: File) => {
    setSelectedFile(file); setResumeTitle(file.name.replace(/\.[^.]+$/, "")); setSaveTitleMode("upload"); setShowTitleDialog(true);
  };

  const handleUploadWithTitle = async () => {
    if (!idToken || !selectedFile || !resumeTitle.trim()) return;
    try {
      setUploading(true);
      const formData = new FormData(); formData.append("title", resumeTitle.trim()); formData.append("resumeFile", selectedFile);
      await apiRequest<{ resume: ResumeItem }>("/resumes", { method: "POST", token: idToken, body: formData });
      toast.success("Resume uploaded successfully");
      setSelectedFile(null); setResumeTitle(""); setShowTitleDialog(false); setSaveTitleMode(null);
      await fetchResumes();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to upload resume"); } 
    finally { setUploading(false); }
  };

  // Builder Handlers
  const fetchProjects = useCallback(async () => {
    if (!idToken) return [] as ProjectSeed[];
    const response = await apiRequest<{ projects: ProjectSeed[] }>("/projects", { token: idToken });
    return response.data.projects;
  }, [idToken]);

  const seedBuilder = (projects: ProjectSeed[]) => {
    const seededProjects: ProjectRow[] = projects.map((p) => ({
      name: p.title,
      technologies: p.stack.join(", "),
      githubUrl: (p.githubUrl || "").trim(),
      demoUrl: (p.demoUrl || "").trim(),
      bulletText: p.description || ""
    }));
    const seededExperience: ExperienceRow[] = (backendUser?.experience ?? []).map((i) => ({ role: i.role ?? "", company: i.company ?? "", location: i.location ?? "", date: i.date ?? "", bulletText: (i.bullets ?? []).join("\n") }));
    const seededAchievements: AchievementRow[] = (backendUser?.achievements ?? []).map((i) => ({ title: i.title ?? "", date: i.date ?? "", bulletText: (i.bullets ?? []).join("\n") }));
    const flattenedSectionSkills = (backendUser?.skillSections ?? []).flatMap((s) => s.skills ?? []);
    const allSavedSkills = Array.from(new Set([ ...(backendUser?.skillLanguages ?? []), ...(backendUser?.skillFrameworks ?? []), ...(backendUser?.skillTools ?? []), ...(backendUser?.skillLibraries ?? []), ...flattenedSectionSkills ].map((i) => i.trim()).filter(Boolean)));
    const seededSkillSections: SkillSectionRow[] = (backendUser?.skillSections ?? []).map((s) => ({ title: (s.title ?? "").trim(), skills: (s.skills ?? []).map((i) => i.trim()).filter(Boolean) })).filter((s) => s.title || s.skills.length > 0);
    const seededEducation: EducationRow[] = (backendUser?.educationEntries?.length ? backendUser.educationEntries.map((i) => ({ school: i.college || "", location: i.location || "", degree: [i.degree, i.specialization].filter(Boolean).join(", "), date: i.endDate || "", grade: i.grade || "" })) : (backendUser?.education ?? []).map((i) => ({ school: i, location: "", degree: "", date: "", grade: "" })));

    setResumeData((c) => ({ ...c, name: backendUser?.displayName ?? "", phone: backendUser?.phone ?? "", email: backendUser?.email ?? "", linkedin: backendUser?.linkedInUrl ?? "", github: backendUser?.githubUrl ?? "", professionalSummary: "", education: [], experience: [], projects: [], achievements: [] }));
    setForceExpandedLayout(false); setStickyExpandedLayout(false); setProfessionalSummaryInput(""); setSkippedExperience(false); setSkippedAchievements(false); setProjectAtsMode({}); setExtendingBulletKey(null); setExtendingProjectIndex(null);
    setEducationRows(seededEducation.length ? seededEducation : [{ ...emptyEducationRow }]);
    setExperienceRows(seededExperience.length ? seededExperience : [{ ...emptyExperienceRow }]);
    setProjectRows(seededProjects.length ? seededProjects : [{ ...emptyProjectRow }]);
    setAchievementRows(seededAchievements.length ? seededAchievements : [{ ...emptyAchievementRow }]);

    if (seededSkillSections.length) setSkillSections(seededSkillSections.map((s) => ({ ...s, skills: s.skills.length ? s.skills : [emptySkillRow] })));
    else if (allSavedSkills.length) setSkillSections([{ title: "Skills", skills: allSavedSkills }]);
    else setSkillSections(defaultSkillSections());
    setBuilderStep(0);
  };

  const openJakeBuilder = async () => {
    if (!idToken) return toast.error("Sign in first");
    try {
      setBuilderLoading(true);
      const projects = await fetchProjects();
      setProjectSeeds(projects); seedBuilder(projects); setShowBuilder(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to load saved data"); } 
    finally { setBuilderLoading(false); }
  };

  const buildResumeDataSnapshot = (projectRowsOverride: ProjectRow[] = projectRows): ResumeData => {
    const education: Education[] = educationRows.map((r) => ({ ...r })).filter((r) => r.school.trim() || r.degree.trim());
    const experience: Experience[] = experienceRows.map((r) => ({ role: r.role, company: r.company, location: r.location, date: r.date, bullets: parseBullets(r.bulletText) })).filter((r) => r.role.trim() || r.company.trim());
    const achievements: Achievement[] = achievementRows.map((r) => ({ title: r.title, date: r.date, bullets: parseBullets(r.bulletText) })).filter((r) => r.title.trim() || r.bullets.length > 0);
    const professionalSummary = showProfessionalSummary ? professionalSummaryInput.trim() : "";
    const maxProjectBullets = optimizeLayout({ ...resumeData, education, experience, projects: [], achievements, professionalSummary }, { forceExpanded: forceExpandedLayout, stickyExpanded: stickyExpandedLayout }).maxProjectBullets;
    const projects: Project[] = projectRowsOverride
      .map((r) => ({
        name: r.name,
        technologies: r.technologies,
        demoUrl: r.demoUrl.trim() || undefined,
        githubUrl: r.githubUrl.trim() || undefined,
        bullets: parseBullets(r.bulletText).slice(0, maxProjectBullets)
      }))
      .filter((r) => r.name.trim());
    
    const normalizedSections = skillSections.map((s) => ({ title: s.title.trim(), skills: s.skills.map((i) => i.trim()).filter(Boolean) })).filter((s) => s.title || s.skills.length > 0);
    const normalizedSectionsLower = normalizedSections.map((s) => ({ title: s.title.toLowerCase(), skills: s.skills }));
    const allSkills = Array.from(new Set(normalizedSections.flatMap((s) => s.skills)));
    const collectByTitle = (kws: string[]) => Array.from(new Set(normalizedSectionsLower.filter((s) => kws.some((k) => s.title.includes(k))).flatMap((s) => s.skills)));
    const languages = collectByTitle(["language", "languages"]); const frameworks = collectByTitle(["framework", "frameworks", "frontend", "backend"]); const tools = collectByTitle(["tool", "tools", "devops", "platform"]); const libraries = collectByTitle(["library", "libraries"]);
    const hasCategorized = Boolean(languages.length || frameworks.length || tools.length || libraries.length);

    return { ...resumeData, professionalSummary: professionalSummary || undefined, education, experience, projects, achievements, skillSections: normalizedSections, skills: { languages: hasCategorized ? languages : allSkills, frameworks: hasCategorized ? frameworks : [], tools: hasCategorized ? tools : [], libraries: hasCategorized ? libraries : [] } };
  };

  // Row Management Utils
  const updateRow = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) => setter((c) => c.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) => setter((c) => c.filter((_, i) => i !== index));
  
  const updateSectionTitle = (sIdx: number, title: string) => setSkillSections((c) => c.map((s, i) => (i === sIdx ? { ...s, title } : s)));
  const updateSectionSkill = (sIdx: number, skIdx: number, value: string) => setSkillSections((c) => c.map((s, i) => i !== sIdx ? s : { ...s, skills: s.skills.map((item, idx) => (idx === skIdx ? value : item)) }));
  const addSectionSkill = (sIdx: number) => setSkillSections((c) => c.map((s, i) => i === sIdx ? { ...s, skills: [...s.skills, emptySkillRow] } : s));
  const removeSectionSkill = (sIdx: number, skIdx: number) => setSkillSections((c) => c.map((s, i) => { if (i !== sIdx) return s; const next = s.skills.filter((_, idx) => idx !== skIdx); return { ...s, skills: next.length ? next : [emptySkillRow] }; }));
  const addSkillSection = () => setSkillSections((c) => [...c, { title: "New Section", skills: [emptySkillRow] }]);
  const removeSkillSection = (sIdx: number) => setSkillSections((c) => { const next = c.filter((_, i) => i !== sIdx); return next.length ? next : defaultSkillSections(); });

  const applyStepData = () => { const snapshot = buildResumeDataSnapshot(); setResumeData(snapshot); return snapshot; };

  // PDF Generation Pipeline
  const getPreviewConfig = (data: ResumeData): PreviewLayoutConfig => {
    const optimized = optimizeLayout(data, { forceExpanded: forceExpandedLayout, stickyExpanded: stickyExpandedLayout });
    return { layout: optimized.layout, headerScale: optimized.fontScaling, lineHeight: optimized.lineHeight, sectionGap: optimized.sectionGap, maxProjectBullets: optimized.maxProjectBullets, skillFormat: optimized.skillFormat };
  };

  const generateResumePdfBlobFallback = async (data: ResumeData, config: PreviewLayoutConfig) => {
    const layout = config.layout || "COMPACT"; const headerScale = config.headerScale ?? 1; const sectionGap = config.sectionGap ?? 15; const lineHeightFactor = config.lineHeight ?? 1.15; const maxProjectBullets = config.maxProjectBullets ?? 3;
    const doc = new jsPDF({ unit: "pt", format: "letter" }); await ensurePdfSerifFont(doc);
    let y = 36; const left = 36; const contentWidth = 540; const centerX = doc.internal.pageSize.getWidth() / 2; const lineBase = Math.round(13 * lineHeightFactor);

    const writeLine = (text: string, x = left, lh = lineBase) => { y = ensurePdfY(doc, y); doc.text(text, x, y); y += lh; };
    const writeWrapped = (text: string, x = left, w = contentWidth, lh = lineBase) => { doc.splitTextToSize(text, w).forEach((line: string) => writeLine(line, x, lh)); };
    const writeLeftRight = (leftText: string, rightText?: string, lh = lineBase) => {
      const right = (rightText ?? "").trim(); const rightWidth = right ? doc.getTextWidth(right) : 0; const leftWidth = right ? Math.max(140, contentWidth - rightWidth - 12) : contentWidth;
      const leftLines = doc.splitTextToSize(leftText || "", leftWidth);
      if (!leftLines.length && right) { y = ensurePdfY(doc, y); doc.text(right, left + contentWidth, y, { align: "right" }); y += lh; return; }
      leftLines.forEach((line: string, i: number) => { y = ensurePdfY(doc, y); doc.text(line, left, y); if (i === 0 && right) doc.text(right, left + contentWidth, y, { align: "right" }); y += lh; });
    };
    const writeSectionTitle = (title: string) => { y += Math.round(sectionGap * 0.55); y = ensurePdfY(doc, y); doc.setFont(pdfSerifFontFamily, "bold"); doc.setFontSize(12 * headerScale); doc.text(title.toUpperCase(), left, y); y += 7; y = ensurePdfY(doc, y); doc.setLineWidth(0.8); doc.line(left, y, left + contentWidth, y); y += 11; doc.setFont(pdfSerifFontFamily, "normal"); doc.setFontSize(10.5); };
    
    // Writers
    const writeProfessionalSummarySection = () => { if (!data.professionalSummary?.trim()) return; writeSectionTitle("Professional Summary"); doc.setFont(pdfSerifFontFamily, "normal"); doc.setFontSize(10); writeWrapped(data.professionalSummary, left, contentWidth, lineBase); };
    doc.setFont(pdfSerifFontFamily, "bold"); doc.setFontSize(22 * headerScale); y = ensurePdfY(doc, y); doc.text(data.name || "Candidate", centerX, y, { align: "center" }); y += 24;
    doc.setFont(pdfSerifFontFamily, "normal"); doc.setFontSize(10);
    const contactItems: Array<{ label: string; url?: string }> = [
      data.phone ? { label: data.phone } : null,
      data.email ? { label: data.email, url: `mailto:${data.email}` } : null,
      data.linkedin ? { label: "LinkedIn", url: data.linkedin } : null,
      data.github ? { label: "GitHub", url: data.github } : null
    ].filter(Boolean) as Array<{ label: string; url?: string }>;
    if (contactItems.length) {
      const separator = " | ";
      const separatorWidth = doc.getTextWidth(separator);
      const itemWidths = contactItems.map((item) => doc.getTextWidth(item.label));
      const totalWidth = itemWidths.reduce((sum, width) => sum + width, 0) + (contactItems.length - 1) * separatorWidth;
      let cursorX = centerX - totalWidth / 2;

      y = ensurePdfY(doc, y);
      contactItems.forEach((item, index) => {
        if (item.url) {
          const jsPdfDoc = doc as jsPDF & {
            textWithLink: (text: string, x: number, y: number, options: { url: string }) => number;
          };
          jsPdfDoc.textWithLink(item.label, cursorX, y, { url: item.url });
        } else {
          doc.text(item.label, cursorX, y);
        }
        cursorX += itemWidths[index];
        if (index < contactItems.length - 1) {
          doc.text(separator, cursorX, y);
          cursorX += separatorWidth;
        }
      });
      y += lineBase + 2;
    }
    
    const writeEducationSection = () => { if (!data.education?.length) return; writeSectionTitle("Education"); data.education.forEach((item) => { doc.setFont(pdfSerifFontFamily, "bold"); writeLeftRight(item.school || "", item.location || "", lineBase); doc.setFont(pdfSerifFontFamily, "italic"); writeLeftRight([item.degree, item.grade].filter(Boolean).join(" - "), item.date || "", lineBase); doc.setFont(pdfSerifFontFamily, "normal"); y += 3; }); };
    const writeExperienceSection = () => { if (!data.experience?.length) return; writeSectionTitle("Experience"); data.experience.forEach((item) => { doc.setFont(pdfSerifFontFamily, "bold"); doc.setFontSize(10.8 * headerScale); writeLeftRight(item.role || "", item.date || "", lineBase); doc.setFont(pdfSerifFontFamily, "italic"); doc.setFontSize(10.2 * headerScale); writeLeftRight(item.company || "", item.location || "", lineBase); doc.setFont(pdfSerifFontFamily, "normal"); doc.setFontSize(10 * headerScale); item.bullets.forEach((b) => writeWrapped(`- ${b}`, left + 14, contentWidth - 14, lineBase)); y += 2; }); };
    const writeProjectsSection = () => {
      if (!data.projects?.length) return;
      writeSectionTitle("Projects");

      data.projects.forEach((item) => {
        const links = [
          item.demoUrl ? { label: "Live", url: item.demoUrl } : null,
          item.githubUrl ? { label: "GitHub", url: item.githubUrl } : null
        ].filter(Boolean) as Array<{ label: string; url: string }>;

        doc.setFont(pdfSerifFontFamily, "italic");
        doc.setFontSize(10.2 * headerScale);
        const separator = " | ";
        const separatorWidth = doc.getTextWidth(separator);
        const tokenWidths = links.map((entry) => doc.getTextWidth(entry.label));
        const linksTotalWidth =
          tokenWidths.reduce((sum, width) => sum + width, 0) +
          Math.max(0, links.length - 1) * separatorWidth;
        const reservedRightWidth = links.length ? linksTotalWidth + 12 : 0;

        doc.setFont(pdfSerifFontFamily, "bold");
        doc.setFontSize(10.8 * headerScale);
        y = ensurePdfY(doc, y);

        const nameText = item.name || "";
        const nameMaxWidth = Math.max(170, contentWidth - reservedRightWidth);
        const nameLines = doc.splitTextToSize(nameText, nameMaxWidth);

        if (!nameLines.length && links.length) {
          let cursorX = left + contentWidth - linksTotalWidth;
          doc.setFont(pdfSerifFontFamily, "italic");
          doc.setFontSize(10.2 * headerScale);
          links.forEach((entry, index) => {
            const jsPdfDoc = doc as jsPDF & {
              textWithLink: (text: string, x: number, y: number, options: { url: string }) => number;
            };
            jsPdfDoc.textWithLink(entry.label, cursorX, y, { url: entry.url });
            cursorX += tokenWidths[index];
            if (index < links.length - 1) {
              doc.text(separator, cursorX, y);
              cursorX += separatorWidth;
            }
          });
          y += lineBase;
        } else {
          nameLines.forEach((line: string, lineIndex: number) => {
            y = ensurePdfY(doc, y);
            doc.setFont(pdfSerifFontFamily, "bold");
            doc.setFontSize(10.8 * headerScale);
            doc.text(line, left, y);

            if (lineIndex === 0 && links.length) {
              let cursorX = left + contentWidth - linksTotalWidth;
              doc.setFont(pdfSerifFontFamily, "italic");
              doc.setFontSize(10.2 * headerScale);
              links.forEach((entry, index) => {
                const jsPdfDoc = doc as jsPDF & {
                  textWithLink: (text: string, x: number, y: number, options: { url: string }) => number;
                };
                jsPdfDoc.textWithLink(entry.label, cursorX, y, { url: entry.url });
                cursorX += tokenWidths[index];
                if (index < links.length - 1) {
                  doc.text(separator, cursorX, y);
                  cursorX += separatorWidth;
                }
              });
            }

            y += lineBase;
          });
        }

        if (item.technologies) {
          doc.setFont(pdfSerifFontFamily, "italic");
          doc.setFontSize(10.2 * headerScale);
          writeWrapped(item.technologies, left, contentWidth, lineBase);
        }

        if (links.length) {
          // keep style reset consistent after link drawing
          doc.setFont(pdfSerifFontFamily, "italic");
          doc.setFontSize(10.2 * headerScale);
        }

        doc.setFont(pdfSerifFontFamily, "normal");
        doc.setFontSize(10 * headerScale);
        item.bullets.slice(0, maxProjectBullets).forEach((b) => writeWrapped(`- ${b}`, left + 14, contentWidth - 14, lineBase));
        y += 2;
      });
    };
    const writeAchievementsSection = () => { if (!data.achievements?.length) return; writeSectionTitle("Achievements"); data.achievements.forEach((item) => { doc.setFont(pdfSerifFontFamily, "bold"); doc.setFontSize(10.8 * headerScale); writeLeftRight(item.title || "", item.date || "", lineBase); doc.setFont(pdfSerifFontFamily, "normal"); doc.setFontSize(10 * headerScale); item.bullets.forEach((b) => writeWrapped(`- ${b}`, left + 14, contentWidth - 14, lineBase)); y += 2; }); };
    const writeSkillsSection = () => { const skillLines = getRenderableSkillLines(data); if (!skillLines.length) return; writeSectionTitle("Skills"); doc.setFont(pdfSerifFontFamily, "normal"); doc.setFontSize(10 * headerScale); skillLines.forEach((line) => { writeWrapped(line.label ? `${line.label}: ${line.value}` : line.value, left, contentWidth, lineBase); }); doc.setFont(pdfSerifFontFamily, "normal"); };

    const exhaustiveWithoutExperience = layout !== "COMPACT" && !(data.experience && data.experience.length > 0);
    const writers = exhaustiveWithoutExperience ? [writeProfessionalSummarySection, writeEducationSection, writeSkillsSection, writeProjectsSection, writeAchievementsSection, writeExperienceSection] : [writeProfessionalSummarySection, writeEducationSection, writeExperienceSection, writeProjectsSection, writeAchievementsSection, writeSkillsSection];
    writers.forEach((w) => w());

    const totalPages = doc.getNumberOfPages();
    if (totalPages > 1) { for (let page = totalPages; page >= 2; page -= 1) doc.deletePage(page); }
    return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
  };

  const generateResumePdfBlob = async (data: ResumeData, config: PreviewLayoutConfig) => generateResumePdfBlobFallback(data, config);
  const countWrappedLines = async (text: string) => { const doc = new jsPDF({ unit: "pt", format: "letter" }); await ensurePdfSerifFont(doc); doc.setFont(pdfSerifFontFamily, "normal"); doc.setFontSize(PROJECT_BULLET_FONT_SIZE); return doc.splitTextToSize(text, PROJECT_BULLET_WRAP_WIDTH).length; };
  const getProjectExtensionBudget = async (projectIndex: number, bulletIndex: number, projectRowsOverride: ProjectRow[] = projectRows) => {
    const snapshot = buildResumeDataSnapshot(projectRowsOverride);
    const freeLines = ONE_PAGE_LINE_LIMIT - estimatePageLines(snapshot);
    if (freeLines <= 0) return { freeLines, maxLines: 0, currentBulletLines: 0 };
    const bullet = parseBullets(projectRowsOverride[projectIndex]?.bulletText ?? "")[bulletIndex] ?? "";
    const currentBulletLines = bullet ? await countWrappedLines(`- ${bullet}`) : 1;
    return { freeLines, currentBulletLines, maxLines: currentBulletLines + freeLines };
  };

  // Builder Navigation
  const goNext = () => {
    const snapshot = applyStepData();
    if (builderStep === stepIndexes.experience && (snapshot.experience?.length ?? 0) > 0) setSkippedExperience(false);
    if (builderStep === stepIndexes.achievements && (snapshot.achievements?.length ?? 0) > 0) setSkippedAchievements(false);
    if (builderStep === 0 && (!snapshot.name.trim() || !snapshot.email.trim())) toast.info("Name and email are recommended.");
    setBuilderStep((s) => Math.min(s + 1, stepTitles.length - 1));
  };
  const skipCurrentOptionalStep = () => {
    if (builderStep === stepIndexes.experience) { setSkippedExperience(true); setExperienceRows([{ ...emptyExperienceRow }]); setBuilderStep(stepIndexes.achievements); return; }
    if (builderStep === stepIndexes.achievements) { setSkippedAchievements(true); setAchievementRows([{ ...emptyAchievementRow }]); setBuilderStep(stepIndexes.skills); }
  };
  const goBack = () => setBuilderStep((s) => Math.max(s - 1, 0));

  // Save Jake Action
  const saveJakeResume = async () => {
    const snapshot = applyStepData(); setResumeTitle(`${snapshot.name || "Candidate"} - Jake Resume`); setSaveTitleMode("jake"); setShowTitleDialog(true);
  };
  const handleJakeSaveWithTitle = async () => {
    if (!idToken || !resumeTitle.trim()) return;
    const snapshot = applyStepData(); const previewConfig = getPreviewConfig(snapshot);
    try {
      setSavingBuilderResume(true);
      const title = resumeTitle.trim();
      const pdfBlob = await generateResumePdfBlob(snapshot, previewConfig);
      const sections = [ snapshot.professionalSummary?.trim(), (snapshot.education?.length ?? 0) > 0, (snapshot.experience?.length ?? 0) > 0, (snapshot.projects?.length ?? 0) > 0, (snapshot.achievements?.length ?? 0) > 0, getRenderableSkillLines(snapshot).length > 0 ].filter(Boolean).length;
      
      const formData = new FormData(); formData.append("title", title); formData.append("sections", String(sections)); formData.append("resumeFile", new File([pdfBlob], `${title}.pdf`, { type: "application/pdf" }));
      await apiRequest<{ resume: ResumeItem }>("/resumes", { method: "POST", token: idToken, body: formData });
      
      toast.success("Jake resume saved as PDF");
      setShowBuilder(false); setShowTitleDialog(false); setSaveTitleMode(null); setResumeTitle("");
      await fetchResumes();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to save resume"); } 
    finally { setSavingBuilderResume(false); }
  };

  // List Item Actions
  const handleViewResume = (id: string) => setExpandedResumeId(expandedResumeId === id ? null : id);
  const handleDeleteResume = async (id: string) => {
    if (!idToken) return;
    try { await apiRequest<{ resumeId: string }>(`/resumes/${id}`, { method: "DELETE", token: idToken }); setResumes((c) => c.filter((i) => i._id !== id)); toast.success("Resume deleted"); } 
    catch (error) { toast.error(error instanceof Error ? error.message : "Failed to delete resume"); }
  };

  const handleDeleteAllResumes = async () => {
    if (!idToken || !resumes.length || deletingAllResumes) return;

    const confirmed = window.confirm("Delete all resumes? This action cannot be undone.");
    if (!confirmed) return;

    try {
      setDeletingAllResumes(true);
      const results = await Promise.allSettled(
        resumes.map((resume) =>
          apiRequest<{ resumeId: string }>(`/resumes/${resume._id}`, { method: "DELETE", token: idToken })
        )
      );

      const successCount = results.filter((item) => item.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (successCount > 0) {
        setResumes([]);
        setExpandedResumeId(null);
      }

      if (failedCount === 0) {
        toast.success(`Deleted all ${successCount} resumes`);
      } else {
        toast.error(`Deleted ${successCount} resumes, ${failedCount} failed`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete all resumes");
    } finally {
      setDeletingAllResumes(false);
    }
  };

  // AI Helpers
  const updateProjectBulletAt = (pIdx: number, bIdx: number, nextBullet: string) => {
    const row = projectRows[pIdx]; if (!row) return;
    const bullets = parseBullets(row.bulletText); if (!bullets[bIdx]) return;
    bullets[bIdx] = nextBullet.trim(); updateRow(setProjectRows, pIdx, { bulletText: bullets.join("\n") });
  };

  const handleExtendProjectBullet = async (pIdx: number, bIdx: number) => {
    if (!idToken) return toast.error("Sign in first");
    const row = projectRows[pIdx]; if (!row) return;
    const bullet = parseBullets(row.bulletText)[bIdx]; if (!bullet) return toast.error("Bullet text required");
    const budget = await getProjectExtensionBudget(pIdx, bIdx);
    if (budget.freeLines <= 0 || budget.maxLines <= 0) return toast.info("No room left on the page to extend this bullet.");

    try {
      setExtendingBulletKey(`${pIdx}-${bIdx}`);
      const response = await apiRequest<{ improvedBullet: string }>("/ai/project-bullet/extend", { method: "POST", token: idToken, body: { bullet, projectName: row.name, technologies: row.technologies, atsOptimized: Boolean(projectAtsMode[pIdx]), maxLines: budget.maxLines } });
      const improved = (response.data.improvedBullet || "").trim();
      if (!improved) return toast.error("AI returned empty output");
      if ((await countWrappedLines(`- ${improved}`)) > budget.maxLines) return toast.info("AI output exceeded the remaining page space.");
      updateProjectBulletAt(pIdx, bIdx, improved); toast.success("Bullet extended successfully");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to extend bullet"); } 
    finally { setExtendingBulletKey(null); }
  };

  const handleExtendAllProjectBullets = async (pIdx: number) => {
    if (!idToken) return toast.error("Sign in first");
    const row = projectRows[pIdx]; if (!row) return;
    const bullets = parseBullets(row.bulletText); if (!bullets.length) return toast.error("Add at least one project bullet first");

    try {
      setExtendingProjectIndex(pIdx);
      const draftRows = [...projectRows]; const nextBullets = [...bullets]; let improvedCount = 0;

      for (let i = 0; i < bullets.length; i += 1) {
        if (!bullets[i]) continue;
        draftRows[pIdx] = { ...row, bulletText: nextBullets.join("\n") };
        const budget = await getProjectExtensionBudget(pIdx, i, draftRows);
        if (budget.freeLines <= 0 || budget.maxLines <= 0) { toast.info("No room left to extend remaining bullets."); break; }

        const response = await apiRequest<{ improvedBullet: string }>("/ai/project-bullet/extend", { method: "POST", token: idToken, body: { bullet: bullets[i], projectName: row.name, technologies: row.technologies, atsOptimized: Boolean(projectAtsMode[pIdx]), maxLines: budget.maxLines } });
        const improved = (response.data.improvedBullet || "").trim();
        if (improved) {
          if ((await countWrappedLines(`- ${improved}`)) > budget.maxLines) { toast.info("One bullet exceeded budget and was skipped."); continue; }
          nextBullets[i] = improved; improvedCount += 1;
        }
      }
      updateRow(setProjectRows, pIdx, { bulletText: nextBullets.join("\n") }); toast.success(`Extended ${improvedCount}/${bullets.length} bullets`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to extend all bullets"); } 
    finally { setExtendingProjectIndex(null); }
  };

  const handleFillPage = () => {
    setForceExpandedLayout(true); setStickyExpandedLayout(true);
    projectRows.forEach((row, index) => {
      if (!parseBullets(row.bulletText).length) updateRow(setProjectRows, index, { bulletText: [ "Built and shipped a production-ready feature with measurable impact", "Improved performance and reliability through focused optimizations", "Collaborated with team members to refine architecture decisions", "Key Achievement: Improved user outcomes with data-backed iteration", "Tech Stack Deep Dive: Designed APIs and persistence around core modules" ].join("\n") });
    });
    toast.success("Fill Page mode enabled: spacing and project depth optimized.");
  };

  const projectEnhancementMode = skippedExperience || skippedAchievements;
  const generatorConfig = (() => {
    if (!generatorTarget) {
      return {
        title: "Generate Description",
        defaultPrompt: AI_PROMPT_PRESETS.resumeExperience,
        context: "",
        onApply: (_value: string) => {}
      };
    }

    if (generatorTarget.kind === "experience") {
      const row = experienceRows[generatorTarget.index] ?? emptyExperienceRow;
      return {
        title: "Generate Experience Points",
        defaultPrompt: AI_PROMPT_PRESETS.resumeExperience,
        context: [
          `Role: ${row.role || "N/A"}`,
          `Company: ${row.company || "N/A"}`,
          `Location: ${row.location || "N/A"}`,
          `Timeline: ${row.date || "N/A"}`,
          `Current bullets: ${row.bulletText || "N/A"}`
        ].join("\n"),
        onApply: (value: string) => updateRow(setExperienceRows, generatorTarget.index, { bulletText: value })
      };
    }

    if (generatorTarget.kind === "achievement") {
      const row = achievementRows[generatorTarget.index] ?? emptyAchievementRow;
      return {
        title: "Generate Achievement Points",
        defaultPrompt: AI_PROMPT_PRESETS.resumeAchievement,
        context: [
          `Title: ${row.title || "N/A"}`,
          `Date: ${row.date || "N/A"}`,
          `Current bullets: ${row.bulletText || "N/A"}`
        ].join("\n"),
        onApply: (value: string) => updateRow(setAchievementRows, generatorTarget.index, { bulletText: value })
      };
    }

    const row = projectRows[generatorTarget.index] ?? emptyProjectRow;
    return {
      title: "Generate Project Points",
      defaultPrompt: AI_PROMPT_PRESETS.resumeProject,
      context: [
        `Project name: ${row.name || "N/A"}`,
        `Technologies: ${row.technologies || "N/A"}`,
        `Date: ${row.date || "N/A"}`,
        `Current bullets: ${row.bulletText || "N/A"}`
      ].join("\n"),
      onApply: (value: string) => updateRow(setProjectRows, generatorTarget.index, { bulletText: value })
    };
  })();

  return (
    <div className="page-shell page-shell-lg space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-4xl font-extrabold text-gradient mb-2 tracking-tight">Resumes</h1>
            <p className="text-muted-foreground text-lg">Manage your master documents and AI-generated variants.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button variant="hero-outline" onClick={() => void openJakeBuilder()} disabled={builderLoading} className="w-full md:w-auto">
              <Wand2 className="h-4 w-4 mr-2 text-primary" /> {builderLoading ? "Loading..." : "Jake Builder"}
            </Button>
            <Button variant="hero" onClick={() => document.getElementById("resume-upload-input")?.click()} disabled={uploading} className="w-full sm:w-auto glow-primary">
              <Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading..." : "Upload File"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Upload Dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-2xl border-2 border-dashed border-primary/20 hover:border-primary/50 transition-all p-6 sm:p-8 lg:p-12 text-center cursor-pointer group relative overflow-hidden"
        onClick={() => document.getElementById("resume-upload-input")?.click()}
      >
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-medium text-foreground mb-1">Click to drop a document here</p>
          <p className="text-sm text-muted-foreground">Supports PDF, DOCX, TXT, TEX, or images up to 10MB</p>
          {selectedFile && <p className="text-sm font-semibold text-primary mt-3 bg-primary/10 px-3 py-1 rounded-full">Ready: {selectedFile.name}</p>}
        </div>
        <input
          id="resume-upload-input" type="file" accept=".pdf,.docx,.doc,.txt,.tex,.png,.jpg,.jpeg,.webp" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelected(file); }}
        />
      </motion.div>

      {/* Resume List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl font-bold text-foreground">Saved Documents</h2>
          <Button
            variant="outline"
            onClick={() => void handleDeleteAllResumes()}
            disabled={deletingAllResumes || !resumes.length}
            className="w-full sm:w-auto hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          >
            <Trash2 className="h-4 w-4 mr-2" /> {deletingAllResumes ? "Deleting..." : "Delete All"}
          </Button>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">Fetching documents...</div>
        ) : resumes.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">No resumes found. Create or upload one above.</div>
        ) : (
          <AnimatePresence>
            {resumes.map((r, i) => (
              <motion.div
                key={r._id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}
                className="glass rounded-xl overflow-hidden group hover:shadow-md transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/20">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-foreground mb-0.5">{r.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="bg-background/50 px-2 py-0.5 rounded-md border border-border/50 font-medium">{r.format}</span>
                        <span>•</span>
                        <span>{r.sections} sections</span>
                        <span>•</span>
                        <span>{new Date(r.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-full sm:w-auto">
                    <Button variant="secondary" size="sm" onClick={() => handleViewResume(r._id)} className="h-9 hover:bg-primary/10 hover:text-primary">
                      {expandedResumeId === r._id ? <><ChevronUp className="h-4 w-4 mr-2" /> Close</> : <><Eye className="h-4 w-4 mr-2" /> View</>}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteResume(r._id)} className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Preview Area */}
                <AnimatePresence>
                  {expandedResumeId === r._id && (r.filePath || r.content) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border/30 bg-black/5 dark:bg-white/5 p-5">
                      {r.filePath ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">Document Viewer</p>
                            <Button size="sm" variant="hero-outline" onClick={() => window.open(`${getBackendOrigin()}${r.filePath}`, "_blank")}>
                              <Download className="h-4 w-4 mr-2" /> Open External
                            </Button>
                          </div>
                          {r.format === "PDF" ? (
                            <iframe src={`${getBackendOrigin()}${r.filePath}`} title="preview" className="w-full h-[70vh] md:h-[600px] rounded-xl border border-border/50 bg-white shadow-inner" />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-12 bg-background/50 rounded-xl border border-border/50 text-center">
                              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                              <p className="text-sm text-muted-foreground">In-page preview not available for {r.format}.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-foreground">Extracted Content</p>
                          <div className="max-h-80 overflow-y-auto bg-background/80 rounded-xl border border-border/50 p-4 custom-scrollbar">
                            <pre className="text-sm whitespace-pre-wrap text-muted-foreground font-mono">{r.content}</pre>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* General Title Modal */}
      <Dialog open={showTitleDialog} onOpenChange={(open) => { setShowTitleDialog(open); if (!open) setSaveTitleMode(null); }}>
        <DialogContent className="glass border-border/50 w-[calc(100vw-1rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{saveTitleMode === "jake" ? "Name Your Jake Resume" : "Name Your Upload"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input value={resumeTitle} onChange={(e) => setResumeTitle(e.target.value)} placeholder="e.g. Master Resume 2026" className="bg-background/50" autoFocus onKeyDown={(e) => e.key === "Enter" && (saveTitleMode === "jake" ? handleJakeSaveWithTitle() : handleUploadWithTitle())} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowTitleDialog(false); setSaveTitleMode(null); }}>Cancel</Button>
            <Button className="glow-primary" onClick={() => saveTitleMode === "jake" ? handleJakeSaveWithTitle() : handleUploadWithTitle()} disabled={uploading || savingBuilderResume || !resumeTitle.trim()}>
              {saveTitleMode === "jake" ? (savingBuilderResume ? "Saving PDF..." : "Generate PDF") : uploading ? "Uploading..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Jake Builder Modal */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="glass border-border/50 w-[calc(100vw-0.75rem)] sm:max-w-5xl max-h-[calc(100vh-0.75rem)] overflow-hidden flex flex-col p-0">
          
          {/* Builder Header */}
          <div className="p-4 sm:p-6 border-b border-border/40 bg-background/20">
            <DialogTitle className="text-xl flex items-center justify-between">
              <span>Jake Resume Builder</span>
              <span className="text-sm font-normal text-muted-foreground bg-background/50 px-3 py-1 rounded-full">Step {builderStep + 1} of {stepTitles.length}</span>
            </DialogTitle>
            
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-background/50 rounded-full mt-4 overflow-hidden flex">
              {stepTitles.map((_, idx) => (
                <div key={idx} className={`h-full flex-1 transition-colors duration-300 ${idx <= builderStep ? "bg-primary" : "bg-transparent"} ${idx > 0 && "border-l border-background/20"}`} />
              ))}
            </div>
            <p className="text-sm font-medium text-primary mt-2">{stepTitles[builderStep]}</p>
          </div>

          {/* Builder Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-background/10 space-y-6">
            {builderStep === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Full Name</label><Input value={resumeData.name} onChange={(e) => setResumeData((c) => ({ ...c, name: e.target.value }))} className="bg-background/50" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Email</label><Input value={resumeData.email} onChange={(e) => setResumeData((c) => ({ ...c, email: e.target.value }))} className="bg-background/50" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Phone</label><Input value={resumeData.phone} onChange={(e) => setResumeData((c) => ({ ...c, phone: e.target.value }))} className="bg-background/50" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">LinkedIn URL</label><Input value={resumeData.linkedin} onChange={(e) => setResumeData((c) => ({ ...c, linkedin: e.target.value }))} className="bg-background/50" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">GitHub URL</label><Input value={resumeData.github} onChange={(e) => setResumeData((c) => ({ ...c, github: e.target.value }))} className="bg-background/50" /></div>
              </div>
            )}

            {builderStep === stepIndexes.professionalSummary && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <p className="text-sm font-medium mb-3 text-foreground">ATS Summary</p>
                <Textarea placeholder="2-3 lines focusing on strengths, domain, and impact..." value={professionalSummaryInput} onChange={(e) => setProfessionalSummaryInput(e.target.value)} className="min-h-[120px] bg-background/50 resize-y" />
              </div>
            )}

            {builderStep === stepIndexes.education && (
              <div className="space-y-4">
                {educationRows.map((row, idx) => (
                  <div key={idx} className="relative rounded-xl border border-border/40 bg-background/30 p-5 group">
                    <Button variant="ghost" size="icon" className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity" onClick={() => removeRow(setEducationRows, idx)}><Trash2 className="h-4 w-4" /></Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                      <Input placeholder="Institution" value={row.school} onChange={(e) => updateRow(setEducationRows, idx, { school: e.target.value })} className="bg-background/50 font-medium" />
                      <Input placeholder="Degree" value={row.degree} onChange={(e) => updateRow(setEducationRows, idx, { degree: e.target.value })} className="bg-background/50" />
                      <Input placeholder="Timeline" value={row.date} onChange={(e) => updateRow(setEducationRows, idx, { date: e.target.value })} className="bg-background/50" />
                      <Input placeholder="Grade / GPA" value={row.grade} onChange={(e) => updateRow(setEducationRows, idx, { grade: e.target.value })} className="bg-background/50" />
                      <Input placeholder="Location" value={row.location} onChange={(e) => updateRow(setEducationRows, idx, { location: e.target.value })} className="bg-background/50 md:col-span-2" />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setEducationRows((c) => [...c, { ...emptyEducationRow }])}><Plus className="h-4 w-4 mr-2" /> Add Education</Button>
              </div>
            )}

            {builderStep === stepIndexes.experience && (
              <div className="space-y-4">
                {experienceRows.map((row, idx) => (
                  <div key={idx} className="relative rounded-xl border border-border/40 bg-background/30 p-5 group space-y-4">
                     <Button variant="ghost" size="icon" className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity" onClick={() => removeRow(setExperienceRows, idx)}><Trash2 className="h-4 w-4" /></Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                      <Input placeholder="Role Title" value={row.role} onChange={(e) => updateRow(setExperienceRows, idx, { role: e.target.value })} className="bg-background/50 font-medium" />
                      <Input placeholder="Company" value={row.company} onChange={(e) => updateRow(setExperienceRows, idx, { company: e.target.value })} className="bg-background/50" />
                      <Input placeholder="Timeline" value={row.date} onChange={(e) => updateRow(setExperienceRows, idx, { date: e.target.value })} className="bg-background/50" />
                      <Input placeholder="Location" value={row.location} onChange={(e) => updateRow(setExperienceRows, idx, { location: e.target.value })} className="bg-background/50" />
                    </div>
                    <Textarea placeholder="Bullet points (one per line)" value={row.bulletText} onChange={(e) => updateRow(setExperienceRows, idx, { bulletText: e.target.value })} className="min-h-[100px] bg-background/50 resize-y" />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="glow-primary" onClick={() => setGeneratorTarget({ kind: "experience", index: idx })}>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setExperienceRows((c) => [...c, { ...emptyExperienceRow }])}><Plus className="h-4 w-4 mr-2" /> Add Experience</Button>
              </div>
            )}

            {builderStep === stepIndexes.achievements && (
              <div className="space-y-4">
                {achievementRows.map((row, idx) => (
                  <div key={idx} className="relative rounded-xl border border-border/40 bg-background/30 p-5 group space-y-4">
                    <Button variant="ghost" size="icon" className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity" onClick={() => removeRow(setAchievementRows, idx)}><Trash2 className="h-4 w-4" /></Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10">
                      <Input placeholder="Achievement Title" value={row.title} onChange={(e) => updateRow(setAchievementRows, idx, { title: e.target.value })} className="bg-background/50 font-medium" />
                      <Input placeholder="Date" value={row.date} onChange={(e) => updateRow(setAchievementRows, idx, { date: e.target.value })} className="bg-background/50" />
                    </div>
                    <Textarea placeholder="Details (one per line)" value={row.bulletText} onChange={(e) => updateRow(setAchievementRows, idx, { bulletText: e.target.value })} className="min-h-[80px] bg-background/50 resize-y" />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="glow-primary" onClick={() => setGeneratorTarget({ kind: "achievement", index: idx })}>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setAchievementRows((c) => [...c, { ...emptyAchievementRow }])}><Plus className="h-4 w-4 mr-2" /> Add Achievement</Button>
              </div>
            )}

            {builderStep === stepIndexes.skills && (
              <div className="space-y-5">
                {skillSections.map((section, sIdx) => (
                  <div key={sIdx} className="rounded-xl border border-border/40 bg-background/30 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <Input placeholder="Category (e.g. Frontend)" value={section.title} onChange={(e) => updateSectionTitle(sIdx, e.target.value)} className="w-full sm:max-w-[300px] bg-background/50 font-semibold" />
                      <Button variant="ghost" size="icon" onClick={() => removeSkillSection(sIdx)} className="hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {section.skills.map((skill, skIdx) => (
                        <div key={skIdx} className="flex items-center gap-1">
                          <Input value={skill} onChange={(e) => updateSectionSkill(sIdx, skIdx, e.target.value)} className="bg-background/50 h-9" />
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 hover:text-destructive" onClick={() => removeSectionSkill(sIdx, skIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => addSectionSkill(sIdx)} className="text-muted-foreground hover:text-primary text-xs"><Plus className="h-3 w-3 mr-1.5" /> Add Item</Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addSkillSection}><Plus className="h-4 w-4 mr-2" /> Add Category</Button>
              </div>
            )}

            {builderStep === stepIndexes.projects && (
              <div className="space-y-5">
                {projectEnhancementMode && (
                  <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm flex gap-3 items-start">
                    <Wand2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Project Deep Dive Required</p>
                      <p className="text-muted-foreground">Since experience is omitted, the AI expects stronger, multi-line project bullets to fill the resume.</p>
                    </div>
                  </div>
                )}

                {projectRows.map((row, idx) => (
                  <div key={idx} className="relative rounded-xl border border-border/40 bg-background/30 p-5 space-y-4 group">
                    <Button variant="ghost" size="icon" className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity" onClick={() => removeRow(setProjectRows, idx)}><Trash2 className="h-4 w-4" /></Button>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pr-10">
                      <Input placeholder="Project Name" value={row.name} onChange={(e) => updateRow(setProjectRows, idx, { name: e.target.value })} className="bg-background/50 font-medium" />
                      <Input placeholder="Technologies" value={row.technologies} onChange={(e) => updateRow(setProjectRows, idx, { technologies: e.target.value })} className="bg-background/50" />
                      <Input placeholder="Live Link (optional)" value={row.demoUrl} onChange={(e) => updateRow(setProjectRows, idx, { demoUrl: e.target.value })} className="bg-background/50" />
                    </div>
                    <Input placeholder="GitHub Link (optional)" value={row.githubUrl} onChange={(e) => updateRow(setProjectRows, idx, { githubUrl: e.target.value })} className="bg-background/50" />
                    <Textarea placeholder="Bullet points (one per line)" value={row.bulletText} onChange={(e) => updateRow(setProjectRows, idx, { bulletText: e.target.value })} className="min-h-[100px] bg-background/50 resize-y" />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="glow-primary" onClick={() => setGeneratorTarget({ kind: "project", index: idx })}>
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between bg-background/50 rounded-lg p-3 border border-border/30 flex-wrap gap-4">
                       <label className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="accent-primary w-4 h-4" checked={Boolean(projectAtsMode[idx])} onChange={(e) => setProjectAtsMode((c) => ({ ...c, [idx]: e.target.checked }))} />
                        Enable ATS Optimization
                      </label>
                      {projectEnhancementMode && (
                        <Button size="sm" variant="hero-outline" disabled={extendingProjectIndex === idx || Boolean(extendingBulletKey)} onClick={() => void handleExtendAllProjectBullets(idx)}>
                          <Sparkles className="w-3.5 h-3.5 mr-2" /> {extendingProjectIndex === idx ? "Expanding..." : "AI Expand All Bullets"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setProjectRows((c) => [...c, { ...emptyProjectRow }])}><Plus className="h-4 w-4 mr-2" /> Add Project</Button>
              </div>
            )}

            {builderStep === stepIndexes.preview && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Live Document Preview</p>
                  <Button variant="outline" size="sm" onClick={handleFillPage} className="h-8">
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Auto-Fill Page
                  </Button>
                </div>
                <div className="bg-white rounded-xl shadow-inner border border-border/30 overflow-hidden relative">
                  <div className="overflow-auto max-h-[500px] custom-scrollbar p-4">
                     <JakeResumePreview data={buildResumeDataSnapshot()} config={getPreviewConfig(buildResumeDataSnapshot())} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Builder Footer */}
          <div className="p-4 border-t border-border/40 bg-background/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={goBack} disabled={builderStep === 0} className="w-full sm:w-auto"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
              {(builderStep === stepIndexes.experience || builderStep === stepIndexes.achievements) && (
                <Button variant="ghost" onClick={skipCurrentOptionalStep} className="w-full sm:w-auto text-muted-foreground hover:text-foreground">Skip Step</Button>
              )}
            </div>
            {builderStep < stepTitles.length - 1 ? (
              <Button variant="hero" onClick={goNext} className="w-full sm:w-auto glow-primary">Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
            ) : (
              <Button variant="hero" onClick={() => void saveJakeResume()} disabled={savingBuilderResume} className="w-full sm:w-auto glow-primary px-8">
                {savingBuilderResume ? "Compiling PDF..." : "Compile & Save PDF"}
              </Button>
            )}
          </div>

        </DialogContent>
      </Dialog>

      <AIDescriptionGeneratorDialog
        open={Boolean(generatorTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setGeneratorTarget(null);
          }
        }}
        idToken={idToken}
        title={generatorConfig.title}
        defaultPrompt={generatorConfig.defaultPrompt}
        context={generatorConfig.context}
        onApply={generatorConfig.onApply}
      />
    </div>
  );
};

export default Resumes;