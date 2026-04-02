import { motion } from "framer-motion";
import { Upload, FileText, Eye, Trash2, Download, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/use-auth";
import { apiRequest } from "@/lib/api";
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
import JakeResumePreview from "@/components/resume/JakeResumePreview";
import type { Achievement, Education, Experience, Project, ResumeData } from "@/components/resume/ResumeTypes";
import { getRenderableSkillLines } from "@/components/resume/skillFormat";
import jsPDF from "jspdf";

type ResumeItem = {
  _id: string;
  title: string;
  format: "PDF" | "DOCX" | "TXT" | "TEX" | "IMAGE";
  sections: number;
  content: string;
  originalFileName?: string;
  filePath?: string;
  updatedAt: string;
};

type ProjectSeed = {
  _id: string;
  title: string;
  description: string;
  stack: string[];
  date?: string;
  updatedAt: string;
};

type EducationRow = {
  school: string;
  location: string;
  degree: string;
  date: string;
  grade: string;
};

type ExperienceRow = {
  role: string;
  company: string;
  location: string;
  date: string;
  bulletText: string;
};

type ProjectRow = {
  name: string;
  technologies: string;
  date: string;
  bulletText: string;
};

type AchievementRow = {
  title: string;
  date: string;
  bulletText: string;
};

const emptySkillRow = "";
type SkillSectionRow = {
  title: string;
  skills: string[];
};

const defaultSkillSections = (): SkillSectionRow[] => [
  { title: "Communication", skills: [emptySkillRow] },
  { title: "Technical", skills: [emptySkillRow] },
  { title: "Collaboration", skills: [emptySkillRow] },
  { title: "Leadership", skills: [emptySkillRow] }
];

const parseBullets = (value: string) =>
  value
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

const initialResumeData: ResumeData = {
  name: "",
  phone: "",
  email: "",
  linkedin: "",
  github: "",
  education: [],
  experience: [],
  projects: [],
  achievements: [],
  skillSections: [],
  skills: {
    languages: [],
    frameworks: [],
    tools: [],
    libraries: []
  }
};

const emptyEducationRow: EducationRow = {
  school: "",
  location: "",
  degree: "",
  date: "",
  grade: ""
};

const emptyExperienceRow: ExperienceRow = {
  role: "",
  company: "",
  location: "",
  date: "",
  bulletText: ""
};

const emptyProjectRow: ProjectRow = {
  name: "",
  technologies: "",
  date: "",
  bulletText: ""
};

const emptyAchievementRow: AchievementRow = {
  title: "",
  date: "",
  bulletText: ""
};

const Resumes = () => {
  const { idToken, backendUser } = useAuth();
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);

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

  const stepTitles = useMemo(
    () => [
      "Basic Contact",
      "Education (Optional)",
      "Experience (Optional)",
      "Projects (Optional)",
      "Achievements (Optional)",
      "Technical Skills (Optional)",
      "Preview and Save"
    ],
    []
  );

  const fetchResumes = useCallback(async () => {
    if (!idToken) {
      setResumes([]);
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest<{ resumes: ResumeItem[] }>("/resumes", { token: idToken });
      setResumes(response.data.resumes);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load resumes");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    void fetchResumes();
  }, [fetchResumes]);

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setResumeTitle(file.name.replace(/\.[^.]+$/, ""));
    setShowTitleDialog(true);
  };

  const handleUploadWithTitle = async () => {
    if (!idToken || !selectedFile || !resumeTitle.trim()) {
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("title", resumeTitle.trim());
      formData.append("resumeFile", selectedFile);

      await apiRequest<{ resume: ResumeItem }>("/resumes", {
        method: "POST",
        token: idToken,
        body: formData
      });
      toast.success("Resume uploaded successfully");
      setSelectedFile(null);
      setResumeTitle("");
      setShowTitleDialog(false);
      await fetchResumes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const handleViewResume = (resumeId: string) => {
    setExpandedResumeId(expandedResumeId === resumeId ? null : resumeId);
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!idToken) {
      return;
    }

    try {
      await apiRequest<{ resumeId: string }>(`/resumes/${resumeId}`, {
        method: "DELETE",
        token: idToken
      });
      setResumes((current) => current.filter((item) => item._id !== resumeId));
      toast.success("Resume deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete resume");
    }
  };

  const fetchProjects = useCallback(async () => {
    if (!idToken) {
      return [] as ProjectSeed[];
    }

    const response = await apiRequest<{ projects: ProjectSeed[] }>("/projects", { token: idToken });
    return response.data.projects;
  }, [idToken]);

  const seedBuilder = (projects: ProjectSeed[]) => {
    const seededProjects: ProjectRow[] = projects.map((project) => ({
      name: project.title,
      technologies: project.stack.join(", "),
      date: project.date?.trim() || new Date(project.updatedAt).toLocaleDateString(),
      bulletText: project.description || ""
    }));

    const seededExperience: ExperienceRow[] = (backendUser?.experience ?? []).map((item) => ({
      role: item.role ?? "",
      company: item.company ?? "",
      location: item.location ?? "",
      date: item.date ?? "",
      bulletText: (item.bullets ?? []).join("\n")
    }));

    const seededAchievements: AchievementRow[] = (backendUser?.achievements ?? []).map((item) => ({
      title: item.title ?? "",
      date: item.date ?? "",
      bulletText: (item.bullets ?? []).join("\n")
    }));

    const flattenedSectionSkills = (backendUser?.skillSections ?? []).flatMap((section) => section.skills ?? []);
    const allSavedSkills = Array.from(
      new Set([
        ...(backendUser?.skillLanguages ?? []),
        ...(backendUser?.skillFrameworks ?? []),
        ...(backendUser?.skillTools ?? []),
        ...(backendUser?.skillLibraries ?? []),
        ...flattenedSectionSkills
      ].map((item) => item.trim()).filter(Boolean))
    );

    const seededSkillSections: SkillSectionRow[] = (backendUser?.skillSections ?? [])
      .map((section) => ({
        title: (section.title ?? "").trim(),
        skills: (section.skills ?? []).map((item) => item.trim()).filter(Boolean)
      }))
      .filter((section) => section.title || section.skills.length > 0);

    const seededEducation: EducationRow[] = (backendUser?.educationEntries?.length
      ? backendUser.educationEntries.map((item) => ({
          school: item.college || "",
          location: item.location || "",
          degree: [item.degree, item.specialization].filter(Boolean).join(", "),
          date: item.endDate || "",
          grade: item.grade || ""
        }))
      : (backendUser?.education ?? []).map((item) => ({
          school: item,
          location: "",
          degree: "",
          date: "",
          grade: ""
        })));

    setResumeData((current) => ({
      ...current,
      name: backendUser?.displayName ?? "",
      email: backendUser?.email ?? "",
      linkedin: backendUser?.linkedInUrl ?? "",
      github: backendUser?.githubUrl ?? "",
      education: [],
      experience: [],
      projects: [],
      achievements: []
    }));

    setEducationRows(seededEducation.length ? seededEducation : [{ ...emptyEducationRow }]);
    setExperienceRows(seededExperience.length ? seededExperience : [{ ...emptyExperienceRow }]);
    setProjectRows(seededProjects.length ? seededProjects : [{ ...emptyProjectRow }]);
    setAchievementRows(seededAchievements.length ? seededAchievements : [{ ...emptyAchievementRow }]);

    if (seededSkillSections.length) {
      setSkillSections(seededSkillSections.map((section) => ({ ...section, skills: section.skills.length ? section.skills : [emptySkillRow] })));
    } else if (allSavedSkills.length) {
      setSkillSections([{ title: "Skills", skills: allSavedSkills }]);
    } else {
      setSkillSections(defaultSkillSections());
    }

    setBuilderStep(0);
  };

  const openJakeBuilder = async () => {
    if (!idToken) {
      toast.error("Sign in first");
      return;
    }

    try {
      setBuilderLoading(true);
      const projects = await fetchProjects();
      setProjectSeeds(projects);
      seedBuilder(projects);
      setShowBuilder(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load saved data");
    } finally {
      setBuilderLoading(false);
    }
  };

  const buildResumeDataSnapshot = (): ResumeData => {
    const education: Education[] = educationRows
      .map((row) => ({ ...row }))
      .filter((row) => row.school.trim() || row.degree.trim());

    const experience: Experience[] = experienceRows
      .map((row) => ({
        role: row.role,
        company: row.company,
        location: row.location,
        date: row.date,
        bullets: parseBullets(row.bulletText)
      }))
      .filter((row) => row.role.trim() || row.company.trim());

    const projects: Project[] = projectRows
      .map((row) => ({
        name: row.name,
        technologies: row.technologies,
        date: row.date,
        bullets: parseBullets(row.bulletText)
      }))
      .filter((row) => row.name.trim());

    const achievements: Achievement[] = achievementRows
      .map((row) => ({
        title: row.title,
        date: row.date,
        bullets: parseBullets(row.bulletText)
      }))
      .filter((row) => row.title.trim() || row.bullets.length > 0);

    const normalizedSections = skillSections
      .map((section) => ({
        title: section.title.trim(),
        skills: section.skills.map((item) => item.trim()).filter(Boolean)
      }))
      .filter((section) => section.title || section.skills.length > 0);

    const normalizedSectionsLower = normalizedSections.map((section) => ({
      title: section.title.toLowerCase(),
      skills: section.skills
    }));

    const allSkills = Array.from(new Set(normalizedSections.flatMap((section) => section.skills)));
    const collectByTitle = (keywords: string[]) =>
      Array.from(
        new Set(
          normalizedSectionsLower
            .filter((section) => keywords.some((keyword) => section.title.includes(keyword)))
            .flatMap((section) => section.skills)
        )
      );

    const languages = collectByTitle(["language", "languages"]);
    const frameworks = collectByTitle(["framework", "frameworks", "frontend", "backend"]);
    const tools = collectByTitle(["tool", "tools", "devops", "platform"]);
    const libraries = collectByTitle(["library", "libraries"]);

    const hasCategorized = Boolean(languages.length || frameworks.length || tools.length || libraries.length);

    return {
      ...resumeData,
      education,
      experience,
      projects,
      achievements,
      skillSections: normalizedSections,
      skills: {
        languages: hasCategorized ? languages : allSkills,
        frameworks: hasCategorized ? frameworks : [],
        tools: hasCategorized ? tools : [],
        libraries: hasCategorized ? libraries : []
      }
    };
  };

  const updateSectionTitle = (sectionIndex: number, title: string) => {
    setSkillSections((current) => current.map((section, index) => (index === sectionIndex ? { ...section, title } : section)));
  };

  const updateSectionSkill = (sectionIndex: number, skillIndex: number, value: string) => {
    setSkillSections((current) =>
      current.map((section, index) => {
        if (index !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          skills: section.skills.map((item, idx) => (idx === skillIndex ? value : item))
        };
      })
    );
  };

  const addSectionSkill = (sectionIndex: number) => {
    setSkillSections((current) =>
      current.map((section, index) =>
        index === sectionIndex ? { ...section, skills: [...section.skills, emptySkillRow] } : section
      )
    );
  };

  const removeSectionSkill = (sectionIndex: number, skillIndex: number) => {
    setSkillSections((current) =>
      current.map((section, index) => {
        if (index !== sectionIndex) {
          return section;
        }

        const next = section.skills.filter((_, idx) => idx !== skillIndex);
        return {
          ...section,
          skills: next.length ? next : [emptySkillRow]
        };
      })
    );
  };

  const addSkillSection = () => {
    setSkillSections((current) => [...current, { title: "New Section", skills: [emptySkillRow] }]);
  };

  const removeSkillSection = (sectionIndex: number) => {
    setSkillSections((current) => {
      const next = current.filter((_, index) => index !== sectionIndex);
      return next.length ? next : defaultSkillSections();
    });
  };

  const applyStepData = () => {
    const snapshot = buildResumeDataSnapshot();
    setResumeData(snapshot);
    return snapshot;
  };

  const generateResumePdfBlobFallback = async (data: ResumeData) => {
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

        let leftX = left + doc.getTextWidth(nameText);
        if (item.technologies) {
          doc.setFont(pdfSerifFontFamily, "italic");
          doc.setFontSize(10.2);
          const techText = ` | ${item.technologies}`;
          doc.text(techText, leftX + 2, y);
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

  const generateResumePdfBlob = async (data: ResumeData) => {
    return generateResumePdfBlobFallback(data);
  };

  const goNext = () => {
    applyStepData();

    if (builderStep === 0 && (!resumeData.name.trim() || !resumeData.email.trim())) {
      toast.info("Name and email are recommended for a complete resume");
    }

    setBuilderStep((step) => Math.min(step + 1, stepTitles.length - 1));
  };

  const goBack = () => {
    setBuilderStep((step) => Math.max(step - 1, 0));
  };

  const saveJakeResume = async () => {
    if (!idToken) {
      return;
    }

    const snapshot = applyStepData();

    try {
      setSavingBuilderResume(true);
      const title = `${snapshot.name || "Candidate"} - Jake Resume`;
      const pdfBlob = await generateResumePdfBlob(snapshot);
      const pdfFile = new File([pdfBlob], `${title}.pdf`, { type: "application/pdf" });
      const formData = new FormData();
      formData.append("title", title);
      formData.append("sections", "6");
      formData.append("resumeFile", pdfFile);

      await apiRequest<{ resume: ResumeItem }>("/resumes", {
        method: "POST",
        token: idToken,
        body: formData
      });
      toast.success("Jake resume saved as PDF");
      setShowBuilder(false);
      await fetchResumes();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save resume");
    } finally {
      setSavingBuilderResume(false);
    }
  };

  const updateRow = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) => {
    setter((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) => {
    setter((current) => current.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8 gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Resumes</h1>
            <p className="text-muted-foreground">Upload and manage your master resumes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void openJakeBuilder()} disabled={builderLoading}>
              <Plus className="h-4 w-4 mr-2" /> {builderLoading ? "Loading..." : "Create Jake Resume"}
            </Button>
            <Button
              variant="hero"
              size="sm"
              onClick={() => document.getElementById("resume-upload-input")?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" /> {uploading ? "Uploading..." : "Upload Resume"}
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-border/50 bg-card/40 p-5 mb-6 flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Create Jake Resume</p>
          <p className="text-xs text-muted-foreground">
            Build a clean Jake-style resume from your saved data, then preview and save it from here.
          </p>
        </div>
        <Button variant="hero-outline" onClick={() => void openJakeBuilder()} disabled={builderLoading}>
          <Plus className="h-4 w-4 mr-2" /> {builderLoading ? "Loading..." : "Create Jake Resume"}
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="border-2 border-dashed border-border/60 rounded-xl p-10 text-center mb-8 hover:border-primary/30 transition-colors cursor-pointer"
        onClick={() => document.getElementById("resume-upload-input")?.click()}
      >
        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-1">Click to choose a resume file</p>
        <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, TEX, or image, up to 10MB</p>
        {selectedFile ? <p className="text-xs text-primary mt-2">Selected: {selectedFile.name}</p> : null}
        <input
          id="resume-upload-input"
          type="file"
          accept=".pdf,.docx,.doc,.txt,.tex,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleFileSelected(file);
            }
          }}
        />
      </motion.div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading resumes...</div>
        ) : resumes.length === 0 ? (
          <div className="text-sm text-muted-foreground">No resumes yet. Create one to get started.</div>
        ) : resumes.map((r, i) => (
          <motion.div
            key={r._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="rounded-xl border border-border/50 bg-card/40 overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 group">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.format} · {r.sections} sections · {new Date(r.updatedAt).toLocaleDateString()}</p>
                  {r.originalFileName ? <p className="text-[11px] text-muted-foreground/80">File: {r.originalFileName}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => handleViewResume(r._id)} title="View resume">
                  {expandedResumeId === r._id ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteResume(r._id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>

            {expandedResumeId === r._id && (r.filePath || r.content) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-border/30 bg-muted/20 p-4"
              >
                {r.filePath ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">File Preview</p>
                    {r.format === "PDF" ? (
                      <div className="space-y-2">
                        <iframe
                          src={`${import.meta.env.VITE_API_URL.replace("/api/v1", "")}${r.filePath}`}
                          title={`${r.title} preview`}
                          className="w-full h-[560px] rounded border border-border/40 bg-background"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const baseUrl = import.meta.env.VITE_API_URL.replace("/api/v1", "");
                              const fileUrl = `${baseUrl}${r.filePath}`;
                              window.open(fileUrl, "_blank");
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Open In New Tab
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          In-page preview is available for PDF files. Use open to view this file.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const baseUrl = import.meta.env.VITE_API_URL.replace("/api/v1", "");
                              const fileUrl = `${baseUrl}${r.filePath}`;
                              window.open(fileUrl, "_blank");
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Open File
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : r.content ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Content Preview</p>
                    <div className="max-h-60 overflow-y-auto bg-background rounded border border-border/30 p-3">
                      <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-mono break-words">
                        {r.content.slice(0, 1200)}
                        {r.content.length > 1200 && "..."}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume Title</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={resumeTitle}
              onChange={(e) => setResumeTitle(e.target.value)}
              placeholder="Enter resume title"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleUploadWithTitle();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTitleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUploadWithTitle()} disabled={uploading || !resumeTitle.trim()}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Create Jake Resume - Step {builderStep + 1}/{stepTitles.length}: {stepTitles[builderStep]}
            </DialogTitle>
          </DialogHeader>

          {builderStep === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Full Name"
                value={resumeData.name}
                onChange={(event) => setResumeData((current) => ({ ...current, name: event.target.value }))}
              />
              <Input
                placeholder="Phone"
                value={resumeData.phone}
                onChange={(event) => setResumeData((current) => ({ ...current, phone: event.target.value }))}
              />
              <Input
                placeholder="Email"
                value={resumeData.email}
                onChange={(event) => setResumeData((current) => ({ ...current, email: event.target.value }))}
              />
              <Input
                placeholder="LinkedIn URL"
                value={resumeData.linkedin}
                onChange={(event) => setResumeData((current) => ({ ...current, linkedin: event.target.value }))}
              />
              <Input
                placeholder="GitHub URL"
                value={resumeData.github}
                onChange={(event) => setResumeData((current) => ({ ...current, github: event.target.value }))}
              />
              <Input readOnly value={`${projectSeeds.length} existing projects prefilled`} />
            </div>
          ) : null}

          {builderStep === 1 ? (
            <div className="space-y-3">
              {educationRows.map((row, index) => (
                <div key={`edu-${index}`} className="grid grid-cols-5 gap-2 rounded-md border border-border/40 p-3">
                  <Input placeholder="College / School" value={row.school} onChange={(event) => updateRow(setEducationRows, index, { school: event.target.value })} />
                  <Input placeholder="Degree" value={row.degree} onChange={(event) => updateRow(setEducationRows, index, { degree: event.target.value })} />
                  <Input placeholder="Date" value={row.date} onChange={(event) => updateRow(setEducationRows, index, { date: event.target.value })} />
                  <Input placeholder="Grade (CGPA or %)" value={row.grade} onChange={(event) => updateRow(setEducationRows, index, { grade: event.target.value })} />
                  <div className="flex gap-2">
                    <Input placeholder="Location" value={row.location} onChange={(event) => updateRow(setEducationRows, index, { location: event.target.value })} />
                    <Button variant="ghost" size="icon" onClick={() => removeRow(setEducationRows, index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setEducationRows((current) => [...current, { ...emptyEducationRow }])}>
                <Plus className="h-4 w-4 mr-2" /> Add Education
              </Button>
            </div>
          ) : null}

          {builderStep === 2 ? (
            <div className="space-y-3">
              {experienceRows.map((row, index) => (
                <div key={`exp-${index}`} className="rounded-md border border-border/40 p-3 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <Input placeholder="Role" value={row.role} onChange={(event) => updateRow(setExperienceRows, index, { role: event.target.value })} />
                    <Input placeholder="Company" value={row.company} onChange={(event) => updateRow(setExperienceRows, index, { company: event.target.value })} />
                    <Input placeholder="Location" value={row.location} onChange={(event) => updateRow(setExperienceRows, index, { location: event.target.value })} />
                    <Input placeholder="Date" value={row.date} onChange={(event) => updateRow(setExperienceRows, index, { date: event.target.value })} />
                  </div>
                  <Textarea
                    placeholder="Bullet points (one per line)"
                    value={row.bulletText}
                    onChange={(event) => updateRow(setExperienceRows, index, { bulletText: event.target.value })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeRow(setExperienceRows, index)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove Row
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setExperienceRows((current) => [...current, { ...emptyExperienceRow }])}>
                <Plus className="h-4 w-4 mr-2" /> Add Experience
              </Button>
            </div>
          ) : null}

          {builderStep === 3 ? (
            <div className="space-y-3">
              {projectRows.map((row, index) => (
                <div key={`proj-${index}`} className="rounded-md border border-border/40 p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Project Name" value={row.name} onChange={(event) => updateRow(setProjectRows, index, { name: event.target.value })} />
                    <Input placeholder="Technologies" value={row.technologies} onChange={(event) => updateRow(setProjectRows, index, { technologies: event.target.value })} />
                    <Input placeholder="Date" value={row.date} onChange={(event) => updateRow(setProjectRows, index, { date: event.target.value })} />
                  </div>
                  <Textarea
                    placeholder="Bullet points (one per line)"
                    value={row.bulletText}
                    onChange={(event) => updateRow(setProjectRows, index, { bulletText: event.target.value })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeRow(setProjectRows, index)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove Row
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setProjectRows((current) => [...current, { ...emptyProjectRow }])}>
                <Plus className="h-4 w-4 mr-2" /> Add Project
              </Button>
            </div>
          ) : null}

          {builderStep === 4 ? (
            <div className="space-y-3">
              {achievementRows.map((row, index) => (
                <div key={`ach-${index}`} className="rounded-md border border-border/40 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Achievement Title" value={row.title} onChange={(event) => updateRow(setAchievementRows, index, { title: event.target.value })} />
                    <Input placeholder="Date" value={row.date} onChange={(event) => updateRow(setAchievementRows, index, { date: event.target.value })} />
                  </div>
                  <Textarea
                    placeholder="Achievement details (one per line)"
                    value={row.bulletText}
                    onChange={(event) => updateRow(setAchievementRows, index, { bulletText: event.target.value })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeRow(setAchievementRows, index)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove Row
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => setAchievementRows((current) => [...current, { ...emptyAchievementRow }])}>
                <Plus className="h-4 w-4 mr-2" /> Add Achievement
              </Button>
            </div>
          ) : null}

          {builderStep === 5 ? (
            <div className="space-y-3">
              {skillSections.map((section, sectionIndex) => (
                <div key={`skill-section-${sectionIndex}`} className="rounded-md border border-border/40 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Section title"
                      value={section.title}
                      onChange={(event) => updateSectionTitle(sectionIndex, event.target.value)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeSkillSection(sectionIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {section.skills.map((skill, skillIndex) => (
                      <div key={`skill-${sectionIndex}-${skillIndex}`} className="flex items-center gap-2">
                        <Input
                          placeholder="Skill"
                          value={skill}
                          onChange={(event) => updateSectionSkill(sectionIndex, skillIndex, event.target.value)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeSectionSkill(sectionIndex, skillIndex)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => addSectionSkill(sectionIndex)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Skill
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addSkillSection}>
                <Plus className="h-4 w-4 mr-2" /> Add Section
              </Button>
            </div>
          ) : null}

          {builderStep === 6 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Preview your Jake-style resume before saving.</p>
              <div className="bg-white">
                <JakeResumePreview data={buildResumeDataSnapshot()} />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={goBack} disabled={builderStep === 0}>
              Back
            </Button>
            {builderStep < stepTitles.length - 1 ? (
              <Button variant="hero" onClick={goNext}>Next</Button>
            ) : (
              <Button variant="hero" onClick={() => void saveJakeResume()} disabled={savingBuilderResume}>
                {savingBuilderResume ? "Saving..." : "Save Resume"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Resumes;
