import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.fn();

vi.mock("fs/promises", () => ({
  default: {
    readFile: readFileMock
  },
  readFile: readFileMock
}));

vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn()
  }
}));

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn()
}));

describe("extractResumeRawText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFileMock.mockImplementation(async (filePath, encoding) => {
      if (encoding === "utf8") {
        return `local text for ${filePath}`;
      }

      return Buffer.from(`local text for ${filePath}`);
    });
  });

  it("falls back to the local upload when a Cloudinary URL cannot be read", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    try {
      const { extractResumeRawText } = await import("../src/services/resume-extraction.service.js");

      const text = await extractResumeRawText({
        content: "Uploaded resume",
        filePath: "https://res.cloudinary.com/demo/raw/upload/v1234567890/resumes/candidate.pdf",
        storedFileName: "candidate.txt"
      });

      expect(text).toContain("local text for");
      expect(readFileMock).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});