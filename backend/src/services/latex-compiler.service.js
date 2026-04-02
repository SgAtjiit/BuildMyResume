import path from "path";
import fs from "fs/promises";
import { createRequire } from "module";
import { env } from "../config/env.js";

const require = createRequire(import.meta.url);
const nodeLatexPdf = require("node-latex-pdf");

const latexBinCandidates = [
  env.LATEX_BIN_DIR,
  "C:/Program Files/MiKTeX/miktex/bin/x64",
  "C:/Program Files/MiKTeX 2.9/miktex/bin/x64",
  `C:/Users/${process.env.USERNAME || ""}/AppData/Local/Programs/MiKTeX/miktex/bin/x64`
].filter(Boolean);

let latexPathPrepared = false;

const ensureLatexPath = async () => {
  if (latexPathPrepared) {
    return;
  }

  const existingPath = process.env.PATH || "";
  const available = [];

  for (const candidate of latexBinCandidates) {
    try {
      await fs.access(path.join(candidate, "pdflatex.exe"));
      available.push(candidate);
    } catch {
      // ignore missing candidate
    }
  }

  if (available.length > 0) {
    process.env.PATH = `${available.join(";")};${existingPath}`;
  }

  latexPathPrepared = true;
};

export const compileLatexToPdf = async (texFilePath, outputDir) => {
  await ensureLatexPath();

  await new Promise((resolve, reject) => {
    nodeLatexPdf(texFilePath, outputDir, (error, message) => {
      if (error) {
        reject(new Error(typeof message === "string" ? message : "node-latex-pdf compilation failed"));
        return;
      }
      resolve(message);
    });
  });

  return "node-latex-pdf";
};
