import type { ResumeData } from "./ResumeTypes";
import { getRenderableSkillLines } from "./skillFormat";

const JakeResumePreview = ({ data }: { data: ResumeData }) => {
  const headingClass = "text-[12pt] font-bold uppercase border-b border-black pb-[2px] mb-[6px] tracking-[0.06em]";
  const skillLines = getRenderableSkillLines(data);

  return (
    <div
      className="max-w-[8.5in] mx-auto p-[0.5in] bg-white text-black leading-[1.15] text-[10.5pt] shadow-lg"
      style={{ fontFamily: '"Noto Serif", "Times New Roman", serif' }}
    >
      <header className="text-center mb-4">
        <h1 className="text-[22pt] font-bold tracking-[0.01em] leading-none">
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

      {data.education && data.education.length > 0 && (
        <section className="mb-3">
          <h2 className={headingClass}>Education</h2>
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
      )}

      {data.experience && data.experience.length > 0 && (
        <section className="mb-3">
          <h2 className={headingClass}>Experience</h2>
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
      )}

      {data.projects && data.projects.length > 0 && (
        <section className="mb-3">
          <h2 className={headingClass}>Projects</h2>
          {data.projects.map((proj, index) => (
            <div key={`${proj.name}-${index}`} className="mb-2.5">
              <div className="flex justify-between items-start gap-3">
                <span className="text-[10pt]">
                  <strong className="font-semibold text-[10.8pt]">{proj.name}</strong>
                  {proj.technologies ? <span className="italic"> | {proj.technologies}</span> : null}
                </span>
                <span className="text-[10.2pt] italic whitespace-nowrap">{proj.date}</span>
              </div>
              <ul className="list-disc ml-5 text-[10pt] mt-1 space-y-[1px] marker:text-black">
                {proj.bullets.map((bullet, i) => (
                  <li key={`${proj.name}-${i}`}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {data.achievements && data.achievements.length > 0 && (
        <section className="mb-3">
          <h2 className={headingClass}>Achievements</h2>
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
      )}

      {skillLines.length > 0 && (
        <section>
          <h2 className={headingClass}>Skills</h2>
          <div className="text-[10pt] space-y-[2px]">
            {skillLines.map((line, index) => (
              <p key={`skill-line-${index}`}>
                {line.label ? <strong>{line.label}: </strong> : null}
                {line.value}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default JakeResumePreview;
