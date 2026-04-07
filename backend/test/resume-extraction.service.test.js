import { beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.fn();
const downloadResumeFromFirebaseStorageMock = vi.fn();
const resolveFirebaseResumeStorageLocationMock = vi.fn((resume) => ({
  bucketName: "demo-project.firebasestorage.app",
  storagePath: resume.firebaseStoragePath || ""
}));

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

vi.mock("../src/utils/firebase-storage.js", () => ({
  downloadResumeFromFirebaseStorage: downloadResumeFromFirebaseStorageMock,
  resolveFirebaseResumeStorageLocation: resolveFirebaseResumeStorageLocationMock
}));

describe("extractResumeRawText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloadResumeFromFirebaseStorageMock.mockResolvedValue({
      buffer: Buffer.from("firebase pdf")
    });
    readFileMock.mockImplementation(async (filePath, encoding) => {
      if (encoding === "utf8") {
        return `local text for ${filePath}`;
      }

      return Buffer.from(`local text for ${filePath}`);
    });
  });

  it("does not fall back to a local upload when a Firebase Storage file cannot be read", async () => {
    downloadResumeFromFirebaseStorageMock.mockRejectedValueOnce(new Error("missing object"));

    const { extractResumeRawText } = await import("../src/services/resume-extraction.service.js");

    const text = await extractResumeRawText({
      content: "Uploaded resume",
      firebaseStoragePath: "buildmyresume/resumes/user_123/candidate.pdf",
      storedFileName: "candidate.txt"
    });

    expect(text).toBe("");
    expect(downloadResumeFromFirebaseStorageMock).toHaveBeenCalledTimes(1);
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
