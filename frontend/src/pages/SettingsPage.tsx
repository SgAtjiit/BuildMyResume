import { motion } from "framer-motion";
import { Globe, User, Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/use-auth";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

const emptySkillRow = "";
type SkillSectionRow = {
  title: string;
  skills: string[];
};

type ExperienceRow = {
  role: string;
  company: string;
  location: string;
  date: string;
  bullets: string;
};

type AchievementRow = {
  title: string;
  date: string;
  bullets: string;
};

type EducationRow = {
  degree: string;
  specialization: string;
  college: string;
  location: string;
  endDate: string;
  grade: string;
};

const emptyExperienceRow: ExperienceRow = {
  role: "",
  company: "",
  location: "",
  date: "",
  bullets: ""
};

const emptyAchievementRow: AchievementRow = {
  title: "",
  date: "",
  bullets: ""
};

const emptyEducationRow: EducationRow = {
  degree: "",
  specialization: "",
  college: "",
  location: "",
  endDate: "",
  grade: ""
};

const defaultSkillSections = (): SkillSectionRow[] => [
  { title: "Communication", skills: [emptySkillRow] },
  { title: "Technical", skills: [emptySkillRow] },
  { title: "Collaboration", skills: [emptySkillRow] },
  { title: "Leadership", skills: [emptySkillRow] }
];

const normalizeSkillSections = (items?: SkillSectionRow[]) =>
  items && items.length
    ? items.map((item, index) => ({
        title: item.title?.trim() || defaultSkillSections()[index % 4].title,
        skills: item.skills && item.skills.length ? item.skills : [emptySkillRow]
      }))
    : defaultSkillSections();

const normalizeExperienceRows = (items?: ExperienceRow[]) => (items && items.length ? items : [emptyExperienceRow]);

const normalizeAchievementRows = (items?: AchievementRow[]) => (items && items.length ? items : [emptyAchievementRow]);

const normalizeEducationRows = (items?: EducationRow[]) => (items && items.length ? items : [emptyEducationRow]);

const parseLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const SettingsPage = () => {
  const { backendUser, idToken, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [leetCodeId, setLeetCodeId] = useState("");
  const [geeksForGeeksId, setGeeksForGeeksId] = useState("");
  const [educationRows, setEducationRows] = useState<EducationRow[]>([emptyEducationRow]);
  const [skillSections, setSkillSections] = useState<SkillSectionRow[]>(defaultSkillSections());
  const [experienceRows, setExperienceRows] = useState<ExperienceRow[]>([emptyExperienceRow]);
  const [achievementRows, setAchievementRows] = useState<AchievementRow[]>([emptyAchievementRow]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(backendUser?.displayName ?? "");
    setCustomDomain(backendUser?.customDomain ?? "");
    setLinkedInUrl(backendUser?.linkedInUrl ?? "");
    setGithubUrl(backendUser?.githubUrl ?? "");
    setLeetCodeId(backendUser?.leetCodeId ?? "");
    setGeeksForGeeksId(backendUser?.geeksForGeeksId ?? "");
    setEducationRows(
      normalizeEducationRows(
        backendUser?.educationEntries?.map((item) => ({
          degree: item.degree ?? "",
          specialization: item.specialization ?? "",
          college: item.college ?? "",
          location: item.location ?? "",
          endDate: item.endDate ?? "",
          grade: item.grade ?? ""
        }))
      )
    );
    setSkillSections(normalizeSkillSections(backendUser?.skillSections));
    setExperienceRows(
      normalizeExperienceRows(
        backendUser?.experience?.map((item) => ({
          role: item.role ?? "",
          company: item.company ?? "",
          location: item.location ?? "",
          date: item.date ?? "",
          bullets: (item.bullets ?? []).join("\n")
        }))
      )
    );
    setAchievementRows(
      normalizeAchievementRows(
        backendUser?.achievements?.map((item) => ({
          title: item.title ?? "",
          date: item.date ?? "",
          bullets: (item.bullets ?? []).join("\n")
        }))
      )
    );
  }, [backendUser]);

  const updateSectionTitle = (index: number, title: string) => {
    setSkillSections((current) => current.map((section, i) => (i === index ? { ...section, title } : section)));
  };

  const updateSectionSkill = (sectionIndex: number, skillIndex: number, value: string) => {
    setSkillSections((current) =>
      current.map((section, i) => {
        if (i !== sectionIndex) {
          return section;
        }

        return {
          ...section,
          skills: section.skills.map((skill, j) => (j === skillIndex ? value : skill))
        };
      })
    );
  };

  const addSectionSkill = (sectionIndex: number) => {
    setSkillSections((current) =>
      current.map((section, i) => (i === sectionIndex ? { ...section, skills: [...section.skills, emptySkillRow] } : section))
    );
  };

  const removeSectionSkill = (sectionIndex: number, skillIndex: number) => {
    setSkillSections((current) =>
      current.map((section, i) => {
        if (i !== sectionIndex) {
          return section;
        }

        const next = section.skills.filter((_, j) => j !== skillIndex);
        return { ...section, skills: next.length ? next : [emptySkillRow] };
      })
    );
  };

  const addSkillSection = () => {
    setSkillSections((current) => [...current, { title: "New Section", skills: [emptySkillRow] }]);
  };

  const removeSkillSection = (sectionIndex: number) => {
    setSkillSections((current) => {
      const next = current.filter((_, i) => i !== sectionIndex);
      return next.length ? next : defaultSkillSections();
    });
  };

  const updateObjectRow = <T,>(setter: Dispatch<SetStateAction<T[]>>, index: number, patch: Partial<T>) => {
    setter((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addObjectRow = <T,>(setter: Dispatch<SetStateAction<T[]>>, fallback: T) => {
    setter((current) => [...current, fallback]);
  };

  const removeObjectRow = <T,>(setter: Dispatch<SetStateAction<T[]>>, fallback: T, index: number) => {
    setter((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [fallback];
    });
  };

  const updateEducationRow = (index: number, patch: Partial<EducationRow>) => {
    setEducationRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addEducationRow = () => {
    setEducationRows((current) => [...current, { ...emptyEducationRow }]);
  };

  const removeEducationRow = (index: number) => {
    setEducationRows((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [{ ...emptyEducationRow }];
    });
  };

  const renderCustomSkillMatrix = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.082 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Skills</h3>
        </div>
        <Button type="button" variant="outline" onClick={addSkillSection}>
          <Plus className="h-4 w-4 mr-2" /> Add Section
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Customize each section title and add as many skill columns as you want. Default 4 sections are provided.</p>
      <div className="space-y-4">
        {skillSections.map((section, sectionIndex) => (
          <div key={`skill-section-${sectionIndex}`} className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={section.title}
                onChange={(event) => updateSectionTitle(sectionIndex, event.target.value)}
                className="bg-background/50 font-medium"
                placeholder="Section title"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeSkillSection(sectionIndex)} title="Remove section">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {section.skills.map((skill, skillIndex) => (
                <div key={`${sectionIndex}-${skillIndex}`} className="flex items-center gap-2">
                  <Input
                    value={skill}
                    onChange={(event) => updateSectionSkill(sectionIndex, skillIndex, event.target.value)}
                    placeholder={`Skill ${skillIndex + 1}`}
                    className="bg-background/50"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSectionSkill(sectionIndex, skillIndex)} title="Remove skill">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={() => addSectionSkill(sectionIndex)}>
              <Plus className="h-4 w-4 mr-2" /> Add Skill
            </Button>
          </div>
        ))}
      </div>
    </motion.div>
  );

  const handleSave = async () => {
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.083 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Education</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Add each education as a row. Degree, college, location and end date are required; specialization and grade are optional.</p>
        <div className="space-y-4">
          {educationRows.map((row, index) => (
            <div key={`education-${index}`} className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Input placeholder="Degree e.g. B.Tech" value={row.degree} onChange={(event) => updateEducationRow(index, { degree: event.target.value })} className="bg-background/50" />
                <Input placeholder="Specialization e.g. CSE (optional)" value={row.specialization} onChange={(event) => updateEducationRow(index, { specialization: event.target.value })} className="bg-background/50" />
                <Input placeholder="College / Institute" value={row.college} onChange={(event) => updateEducationRow(index, { college: event.target.value })} className="bg-background/50" />
                <Input placeholder="Location e.g. Noida" value={row.location} onChange={(event) => updateEducationRow(index, { location: event.target.value })} className="bg-background/50" />
                <Input placeholder="End Date e.g. July 2027" value={row.endDate} onChange={(event) => updateEducationRow(index, { endDate: event.target.value })} className="bg-background/50" />
                <Input placeholder="Grade e.g. 8.5 CGPA or 82% (optional)" value={row.grade} onChange={(event) => updateEducationRow(index, { grade: event.target.value })} className="bg-background/50" />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeEducationRow(index)} title="Remove education">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addEducationRow}>
            <Plus className="h-4 w-4 mr-2" /> Add Education
          </Button>
        </div>
      </motion.div>

    if (!idToken) {
      return;
    }

    setSaving(true);

    try {
      const normalizedSkillSections = skillSections
        .map((section) => ({
          title: section.title.trim(),
          skills: unique(section.skills)
        }))
        .filter((section) => section.title || section.skills.length > 0);

      const sectionSkillsByTitle = normalizedSkillSections.map((section) => ({
        title: section.title.toLowerCase(),
        skills: section.skills
      }));

      const collectByTitle = (keywords: string[]) =>
        unique(
          sectionSkillsByTitle
            .filter((section) => keywords.some((keyword) => section.title.includes(keyword)))
            .flatMap((section) => section.skills)
        );

      const allSectionSkills = unique(normalizedSkillSections.flatMap((section) => section.skills));

      const skillLanguages = collectByTitle(["language", "languages"]);
      const skillFrameworks = collectByTitle(["framework", "frameworks", "frontend", "backend"]);
      const skillTools = collectByTitle(["tool", "tools", "devops", "platform"]);
      const skillLibraries = collectByTitle(["library", "libraries"]);

      const hasAnyCategorized = skillLanguages.length || skillFrameworks.length || skillTools.length || skillLibraries.length;

      await apiRequest<{ user: unknown }>("/auth/me", {
        method: "PATCH",
        token: idToken,
        body: {
          displayName,
          customDomain,
          linkedInUrl,
          githubUrl,
          leetCodeId,
          geeksForGeeksId,
          education: educationRows
            .map((item) => [item.degree, item.specialization, item.college, item.location, item.endDate, item.grade].filter(Boolean).join(" | "))
            .filter(Boolean),
          educationEntries: educationRows
            .map((item) => ({
              degree: item.degree.trim(),
              specialization: item.specialization.trim(),
              college: item.college.trim(),
              location: item.location.trim(),
              endDate: item.endDate.trim(),
              grade: item.grade.trim()
            }))
            .filter((item) => item.degree || item.specialization || item.college || item.location || item.endDate || item.grade),
          skillSections: normalizedSkillSections,
          skillLanguages: hasAnyCategorized ? skillLanguages : allSectionSkills,
          skillFrameworks: hasAnyCategorized ? skillFrameworks : [],
          skillTools: hasAnyCategorized ? skillTools : [],
          skillLibraries: hasAnyCategorized ? skillLibraries : [],
          experience: experienceRows
            .map((item) => ({
              role: item.role.trim(),
              company: item.company.trim(),
              location: item.location.trim(),
              date: item.date.trim(),
              bullets: parseLines(item.bullets)
            }))
            .filter((item) => item.role || item.company || item.bullets.length > 0),
          achievements: achievementRows
            .map((item) => ({
              title: item.title.trim(),
              date: item.date.trim(),
              bullets: parseLines(item.bullets)
            }))
            .filter((item) => item.title || item.bullets.length > 0)
        }
      });

      await refreshProfile();
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground mb-8">Manage your account and domain configuration.</p>
      </motion.div>

      {/* Professional IDs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Professional Profiles</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">LinkedIn URL</label>
            <Input value={linkedInUrl} onChange={(event) => setLinkedInUrl(event.target.value)} className="bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">GitHub URL</label>
            <Input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} className="bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">LeetCode ID</label>
            <Input value={leetCodeId} onChange={(event) => setLeetCodeId(event.target.value)} className="bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">GeeksforGeeks ID</label>
            <Input value={geeksForGeeksId} onChange={(event) => setGeeksForGeeksId(event.target.value)} className="bg-background/50" />
          </div>
        </div>
      </motion.div>

      {renderCustomSkillMatrix()}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.082 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Education</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Add one education record per row with separate columns.</p>
        <div className="space-y-4">
          {educationRows.map((row, index) => (
            <div key={`education-${index}`} className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Degree" value={row.degree} onChange={(event) => updateObjectRow(setEducationRows, index, { degree: event.target.value })} className="bg-background/50" />
                <Input placeholder="Specialization" value={row.specialization} onChange={(event) => updateObjectRow(setEducationRows, index, { specialization: event.target.value })} className="bg-background/50" />
                <Input placeholder="College / University" value={row.college} onChange={(event) => updateObjectRow(setEducationRows, index, { college: event.target.value })} className="bg-background/50" />
                <Input placeholder="Location" value={row.location} onChange={(event) => updateObjectRow(setEducationRows, index, { location: event.target.value })} className="bg-background/50" />
                <Input placeholder="End date" value={row.endDate} onChange={(event) => updateObjectRow(setEducationRows, index, { endDate: event.target.value })} className="bg-background/50" />
                <Input placeholder="Grade" value={row.grade} onChange={(event) => updateObjectRow(setEducationRows, index, { grade: event.target.value })} className="bg-background/50" />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeObjectRow(setEducationRows, emptyEducationRow, index)} title="Remove education">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => addObjectRow(setEducationRows, { ...emptyEducationRow })}>
            <Plus className="h-4 w-4 mr-2" /> Add Education
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.085 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Experience</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Add one experience per row with separate bullet points.</p>
        <div className="space-y-4">
          {experienceRows.map((row, index) => (
            <div key={`experience-${index}`} className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Role" value={row.role} onChange={(event) => updateObjectRow(setExperienceRows, index, { role: event.target.value })} className="bg-background/50" />
                <Input placeholder="Company" value={row.company} onChange={(event) => updateObjectRow(setExperienceRows, index, { company: event.target.value })} className="bg-background/50" />
                <Input placeholder="Location" value={row.location} onChange={(event) => updateObjectRow(setExperienceRows, index, { location: event.target.value })} className="bg-background/50" />
                <Input placeholder="Date" value={row.date} onChange={(event) => updateObjectRow(setExperienceRows, index, { date: event.target.value })} className="bg-background/50" />
              </div>
              <Textarea
                value={row.bullets}
                onChange={(event) => updateObjectRow(setExperienceRows, index, { bullets: event.target.value })}
                placeholder={`One bullet per line\nBuilt and shipped...\nImproved...`}
                className="min-h-[110px] bg-background/50"
              />
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeObjectRow(setExperienceRows, emptyExperienceRow, index)} title="Remove experience">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => addObjectRow(setExperienceRows, { ...emptyExperienceRow })}>
            <Plus className="h-4 w-4 mr-2" /> Add Experience
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.087 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Achievements</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Add one achievement per row. Each row is saved as bullet points.</p>
        <div className="space-y-4">
          {achievementRows.map((row, index) => (
            <div key={`achievement-${index}`} className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Achievement title" value={row.title} onChange={(event) => updateObjectRow(setAchievementRows, index, { title: event.target.value })} className="bg-background/50" />
                <Input placeholder="Date" value={row.date} onChange={(event) => updateObjectRow(setAchievementRows, index, { date: event.target.value })} className="bg-background/50" />
              </div>
              <Textarea
                value={row.bullets}
                onChange={(event) => updateObjectRow(setAchievementRows, index, { bullets: event.target.value })}
                placeholder={`One bullet per line\nWon first prize in...\nRanked among top...`}
                className="min-h-[110px] bg-background/50"
              />
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeObjectRow(setAchievementRows, emptyAchievementRow, index)} title="Remove achievement">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => addObjectRow(setAchievementRows, { ...emptyAchievementRow })}>
            <Plus className="h-4 w-4 mr-2" /> Add Achievement
          </Button>
        </div>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Profile</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Full Name</label>
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="bg-background/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
            <Input value={backendUser?.email ?? ""} readOnly className="bg-background/50" />
          </div>
        </div>
      </motion.div>

      {/* Domain */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Custom Domain</h3>
        </div>
        <div className="mb-4">
          <label className="text-xs text-muted-foreground mb-1.5 block">Your Domain</label>
          <Input value={customDomain} onChange={(event) => setCustomDomain(event.target.value)} className="bg-background/50 font-mono" />
        </div>
        <div className="rounded-lg bg-background/50 border border-border/30 p-4">
          <p className="text-xs font-medium text-foreground mb-2">DNS Configuration</p>
          <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
            <p>A Record: *.johndoe.dev → 185.158.133.1</p>
            <p>TXT Record: _lovable → lovable_verify=abc123</p>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border border-border/50 bg-card/40 p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Notifications</h3>
        </div>
        <p className="text-sm text-muted-foreground">Email notifications for portfolio views and resume downloads.</p>
      </motion.div>

      <div className="flex justify-end">
        <Button variant="hero" onClick={handleSave} disabled={saving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
