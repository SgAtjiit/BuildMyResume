import type { ResumeData } from "./ResumeTypes";
import { getRenderableSkillLines } from "./skillFormat";

export type PreviewLayoutConfig = {
  layout?: "COMPACT" | "EXHAUSTIVE";
  skillFormat?: "INLINE" | "GRID";
  headerScale?: number;
  lineHeight?: number;
  sectionGap?: number;
  maxProjectBullets?: number;
};

const JakeResumePreview = ({ data, config }: { data: ResumeData; config?: PreviewLayoutConfig }) => {
  const layout = config?.layout || "COMPACT";
  const sectionGap = config?.sectionGap ?? 12;
  const headerScale = config?.headerScale ?? 1;
  const lineHeight = config?.lineHeight ?? 1.15;
  const maxProjectBullets = config?.maxProjectBullets ?? 3;
  const skillFormat = config?.skillFormat ?? "INLINE";
  const headingClass = "font-bold uppercase border-b border-black pb-[2px] mb-[6px] tracking-[0.06em]";
  const sectionStyle = { marginBottom: `${sectionGap}px` };
  const skillLines = getRenderableSkillLines(data);
  const projectItems = (data.projects ?? []).map((item) => ({
    ...item,
    bullets: (item.bullets ?? []).slice(0, maxProjectBullets)
  }));

  const professionalSummarySection = data.professionalSummary?.trim() && (
    <section style={sectionStyle}>
      <h2 className={headingClass} style={{ fontSize: `${11.8 * headerScale}pt` }}>Professional Summary</h2>
      <p className="text-[10pt]">{data.professionalSummary}</p>
    </section>
  );

  const educationSection = data.education && data.education.length > 0 && (
    <section style={sectionStyle}>
      <h2 className={headingClass} style={{ fontSize: `${12 * headerScale}pt` }}>Education</h2>
      {data.education.map((edu, index) => (
        <div key={`${edu.school}-${index}`} className="mb-2">
          <div className="flex justify-between font-semibold text-[10.8pt]">
            <span>{edu.school}</span>
            <span>{edu.location}</span>
          </div>
          <div className="flex justify-between italic text-[10.2pt]">
            <span>{[edu.degree, edu.grade].filter(Boolean).join(" - ")}</span>
            <span>{edu.date}</span>
          </div>
        </div>
      ))}
    </section>
  );

  const experienceSection = data.experience && data.experience.length > 0 && (
    <section style={sectionStyle}>
      <h2 className={headingClass} style={{ fontSize: `${12 * headerScale}pt` }}>Experience</h2>
      {data.experience.map((exp, index) => (
        <div key={`${exp.company}-${index}`} className="mb-2.5">
          <div className="flex justify-between font-semibold text-[10.8pt]">
            <span>{exp.role}</span>
            <span>{exp.date}</span>
          </div>
          <div className="flex justify-between italic text-[10.2pt] mb-1">
            <span>{exp.company}</span>
            <span>{exp.location}</span>
          </div>
          <ul className="list-disc ml-5 text-[10pt] space-y-[1px] marker:text-black">
            {exp.bullets.map((bullet, i) => (
              <li key={`${exp.company}-${i}`}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );

  const projectsSection = projectItems.length > 0 && (
    <section style={sectionStyle}>
      <h2 className={headingClass} style={{ fontSize: `${12 * headerScale}pt` }}>Projects</h2>
      {projectItems.map((proj, index) => (
        <div key={`${proj.name}-${index}`} className="mb-2.5">
          <div className="flex justify-between gap-3">
            <span className="font-semibold text-[10.8pt] leading-tight">{proj.name}</span>
            <span className="text-[10.2pt] italic whitespace-nowrap">{proj.date}</span>
          </div>
          {proj.technologies ? (
            <div className="text-[10.2pt] italic leading-tight mt-0.5 break-words">{proj.technologies}</div>
          ) : null}
          <ul className="list-disc ml-5 text-[10pt] mt-1 space-y-[1px] marker:text-black">
            {proj.bullets.map((bullet, i) => (
              <li key={`${proj.name}-${i}`}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );

  const achievementsSection = data.achievements && data.achievements.length > 0 && (
    <section style={sectionStyle}>
      <h2 className={headingClass} style={{ fontSize: `${12 * headerScale}pt` }}>Achievements</h2>
      {data.achievements.map((item, index) => (
        <div key={`${item.title}-${index}`} className="mb-2.5">
          <div className="flex justify-between font-semibold text-[10.8pt]">
            <span>{item.title}</span>
            <span className="italic text-[10.2pt]">{item.date}</span>
          </div>
          <ul className="list-disc ml-5 text-[10pt] mt-1 space-y-[1px] marker:text-black">
            {item.bullets.map((bullet, i) => (
              <li key={`${item.title}-${i}`}>{bullet}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );

  const skillsSection = skillLines.length > 0 && (
    <section>
      <h2 className={headingClass} style={{ fontSize: `${12 * headerScale}pt` }}>Skills</h2>
      {skillFormat === "GRID" ? (
        <div className="grid grid-cols-2 gap-1 text-[9.7pt]">
          {skillLines.map((line, index) => (
            <div key={`skill-line-${index}`} className="border border-black/20 rounded-sm px-2 py-1">
              {line.label ? <strong>{line.label}: </strong> : null}
              {line.value}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[10pt] space-y-[2px]">
          {skillLines.map((line, index) => (
            <p key={`skill-line-${index}`}>
              {line.label ? <strong>{line.label}: </strong> : null}
              {line.value}
            </p>
          ))}
        </div>
      )}
    </section>
  );

  const exhaustiveWithoutExperience = layout !== "COMPACT" && !(data.experience && data.experience.length > 0);
  const orderedSections = exhaustiveWithoutExperience
    ? [professionalSummarySection, educationSection, skillsSection, projectsSection, achievementsSection, experienceSection]
    : [professionalSummarySection, educationSection, experienceSection, projectsSection, achievementsSection, skillsSection];

  return (
    <div
      className="max-w-[8.5in] mx-auto p-[0.5in] bg-white text-black text-[10.5pt] shadow-lg"
      style={{
        fontFamily: '"Noto Serif", "Times New Roman", serif',
        lineHeight: `${lineHeight}`
      }}
    >
      <header className="text-center mb-4">
        <h1 className="font-bold tracking-[0.01em] leading-none" style={{ fontSize: `${22 * headerScale}pt` }}>
          {data.name || "Your Name"}
        </h1>
        <div className="flex justify-center gap-2 mt-1 text-[10pt] flex-wrap">
          <span>{data.phone || "Phone"}</span>|
          <a href={data.email ? `mailto:${data.email}` : undefined} className="underline">
            {data.email || "email@example.com"}
          </a>
          |
          <a href={data.linkedin || undefined} className="underline">
            {data.linkedin || "linkedin.com/in/username"}
          </a>
          |
          <a href={data.github || undefined} className="underline">
            {data.github || "github.com/username"}
          </a>
        </div>
      </header>

      {orderedSections}
    </div>
  );
};

export default JakeResumePreview;
