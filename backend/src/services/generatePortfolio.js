import Groq from "groq-sdk";
import { env } from "../config/env.js";

const groq = new Groq({
  apiKey: env.GROQ_API_KEY
});

const sanitizeHtmlResponse = (raw) => {
  const value = String(raw || "").trim();
  const doctypeIndex = value.search(/<!doctype\s+html/i);
  const htmlIndex = value.search(/<html[\s>]/i);

  let startIndex = -1;
  if (doctypeIndex !== -1) {
    startIndex = doctypeIndex;
  } else if (htmlIndex !== -1) {
    startIndex = htmlIndex;
  }

  if (startIndex === -1) {
    throw new Error("No valid HTML found in model response");
  }

  let sanitized = value.slice(startIndex).trim();
  if (sanitized.endsWith("```")) {
    sanitized = sanitized.slice(0, -3).trim();
  }

  return sanitized;
};

const normalizeUrl = (value) => {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }

  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(input)) {
    return input;
  }

  if (/^www\./i.test(input)) {
    return `https://${input}`;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(input)) {
    return `https://${input}`;
  }

  return input;
};

const normalizeGeneratedLinks = (html) => {
  let output = String(html || "");

  // Convert markdown-style URL wrappers sometimes emitted by the model.
  output = output.replace(
    /(href|src)=(['"])\[(https?:\/\/[^\]]+)\]\(https?:\/\/[^)]+\)\2/gi,
    "$1=\"$3\""
  );

  // Ensure external links have protocol if model outputs bare domains.
  output = output.replace(/href=(['"])([^'"]+)\1/gi, (full, quote, url) => {
    if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(url)) {
      return full;
    }

    if (/^www\./i.test(url) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)) {
      return `href=${quote}https://${url}${quote}`;
    }

    return full;
  });

  return output;
};

const ensureRequiredSectionIds = (html) => {
  let output = String(html || "");
  const requiredIds = ["about", "skills", "projects", "contact"];
  const missingIds = requiredIds.filter((id) => !new RegExp(`id=["']${id}["']`, "i").test(output));

  if (!missingIds.length) {
    return output;
  }

  const fallbackSections = missingIds
    .map((id) => `<section id="${id}" class="hidden" aria-hidden="true"></section>`)
    .join("\n");

  if (/<\/main>/i.test(output)) {
    output = output.replace(/<\/main>/i, `${fallbackSections}\n</main>`);
  } else if (/<\/body>/i.test(output)) {
    output = output.replace(/<\/body>/i, `${fallbackSections}\n</body>`);
  } else {
    output = `${output}\n${fallbackSections}`;
  }

  return output;
};

const buildPrompt = (user, userPreference) => {
  const userData = {
    name: user.displayName || "",
    bio: user.bio || "",
    avatarUrl: user.photoURL || "",
    skills: [
      ...(user.skillLanguages || []),
      ...(user.skillFrameworks || []),
      ...(user.skillLibraries || []),
      ...(user.skillTools || [])
    ],
    projects: (user.projects || []).map((project) => ({
      title: project.title || "",
      description: project.description || "",
      link: normalizeUrl(project.link || project.demoUrl || project.githubUrl || ""),
      techStack: project.stack || []
    })),
    social: {
      linkedIn: normalizeUrl(user.linkedInUrl || ""),
      github: normalizeUrl(user.githubUrl || "")
    }
  };

  return `You are an elite, Awwwards-winning UI/UX Frontend Developer. Your task is to generate a world-class single-file portfolio website.

USER DATA:
${JSON.stringify(userData, null, 2)}

USER PREFERENCE (THEME):
${userPreference || "Dark mode, modern minimalist, premium glassmorphism."}

CRITICAL INSTRUCTIONS & LOGIC:
1. STRICT SKELETON: You MUST use the exact HTML skeleton provided below. Do NOT alter the <head> tags or the <script> logic at the bottom.
2. NAVIGATION: Build a sticky glassmorphism navbar with links to #about, #skills, #projects, and #contact.
3. HERO & SOCIALS (id="about"): Display 'name' and 'bio'. Render social links (LinkedIn, GitHub) ONLY if the URLs are not empty. Use FontAwesome icons.
4. SKILLS (SHOW MORE LOGIC) (id="skills"): Iterate through the 'skills' array. Display the first 10 normally. For any skill beyond the 10th, you MUST add the exact CSS classes "extra-skill hidden". Below the skills grid, add a stylish button exactly like this: <button onclick="toggleElements('extra-skill', this)" class="mt-6 px-6 py-2 bg-indigo-600 rounded-full hover:bg-indigo-700 transition">Show More</button>.
5. PROJECTS (SHOW MORE LOGIC) (id="projects"): Iterate through the 'projects' array. Display the first 3 normally. For any project beyond the 3rd, you MUST add the exact CSS classes "extra-project hidden". Below the project grid, add a button exactly like this: <button onclick="toggleElements('extra-project', this)" class="mt-8 px-6 py-2 border border-white/20 rounded-full hover:bg-white/10 transition">Show More</button>.
6. CONTACT FORM (id="contact"): Build a beautiful, modern contact form section at the bottom.
7. NO MARKDOWN: Output strictly valid HTML. Start immediately with <!DOCTYPE html>.
8. ID GUARANTEE: The final HTML MUST contain elements with exact IDs: about, skills, projects, contact.

MANDATORY HTML SKELETON:
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${userData.name || 'Portfolio'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { font-family: 'Outfit', sans-serif; }
        .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
    </style>
</head>
<body class="bg-gray-900 text-white antialiased overflow-x-hidden">
    
    <main>
        </main>

    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    <script>
        AOS.init({ duration: 800, once: true });
        
        // Toggles visibility for Show More / Show Less buttons
        function toggleElements(className, btn) {
            const elements = document.querySelectorAll('.' + className);
            let isHidden = false;
            elements.forEach(el => {
                if (el.classList.contains('hidden')) {
                    el.classList.remove('hidden');
                    isHidden = true; // Was hidden, now showing
                } else {
                    el.classList.add('hidden');
                }
            });
            btn.innerText = isHidden ? 'Show Less' : 'Show More';
        }
    </script>
</body>
</html>`;
};

export const generatePortfolio = async (userProfile, userPreference = "", options = {}) => {
  const traceId = options.traceId || "";
  const prompt = buildPrompt(userProfile, userPreference);

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 7500, 
      temperature: 0.3, // Keep low to ensure strict adherence to class names
      messages: [
        {
          role: "system",
          content: "You are an automated code generator. You strictly output valid HTML5 based on the provided skeleton. You must extract and display all user data provided. No explanations. No markdown formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const rawHtml = response.choices?.[0]?.message?.content || "";
    const sanitized = sanitizeHtmlResponse(rawHtml);
    const withFixedLinks = normalizeGeneratedLinks(sanitized);
    return ensureRequiredSectionIds(withFixedLinks);
  } catch (error) {
    console.error("[generatePortfolio] Error:", error);
    throw error;
  }
};