import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
const getMetadataMock = vi.fn();
const downloadMock = vi.fn();
const deleteMock = vi.fn();
const getSignedUrlMock = vi.fn();
const fileMock = vi.fn(() => ({
  save: saveMock,
  getMetadata: getMetadataMock,
  download: downloadMock,
  delete: deleteMock,
  getSignedUrl: getSignedUrlMock
}));
const getFirebaseStorageBucketMock = vi.fn(() => ({
  name: "demo-project.firebasestorage.app",
  file: fileMock
}));

vi.mock("../src/config/firebase.js", () => ({
  getFirebaseStorageBucket: getFirebaseStorageBucketMock
}));

vi.mock("../src/config/env.js", () => ({
  env: {
    FIREBASE_STORAGE_BUCKET: "demo-project.firebasestorage.app",
    FIREBASE_RESUME_FOLDER: "buildmyresume/resumes",
    FIREBASE_SIGNED_URL_TTL_MINUTES: 60
  }
}));

describe("firebase resume storage helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMetadataMock.mockResolvedValue([{ contentType: "application/pdf", size: "42" }]);
    downloadMock.mockResolvedValue([Buffer.from("pdf bytes")]);
    deleteMock.mockResolvedValue(undefined);
    getSignedUrlMock.mockResolvedValue(["https://storage.googleapis.com/signed/resume.pdf"]);
  });

  it("uploads resume buffers into Firebase Storage under the configured folder", async () => {
    const { uploadResumeToFirebaseStorage } = await import("../src/utils/firebase-storage.js");

    const result = await uploadResumeToFirebaseStorage({
      buffer: Buffer.from("resume pdf"),
      originalFileName: "Shrish Gupta Resume.pdf",
      mimeType: "application/pdf",
      ownerKey: "user_123"
    });

    const storagePath = fileMock.mock.calls[0][0];

    expect(getFirebaseStorageBucketMock).toHaveBeenCalledTimes(1);
    expect(storagePath).toMatch(
      /^buildmyresume\/resumes\/user_123\/\d+-[0-9a-f-]+-Shrish_Gupta_Resume\.pdf$/i
    );
    expect(saveMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        resumable: false,
        validation: false,
        metadata: expect.objectContaining({
          contentType: "application/pdf"
        })
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        bucketName: "demo-project.firebasestorage.app",
        storagePath,
        fileName: expect.stringMatching(/Shrish_Gupta_Resume\.pdf$/),
        filePath: `gs://demo-project.firebasestorage.app/${storagePath}`
      })
    );
  });

  it("downloads resume bytes and metadata from Firebase Storage", async () => {
    const { downloadResumeFromFirebaseStorage } = await import("../src/utils/firebase-storage.js");

    const result = await downloadResumeFromFirebaseStorage({
      bucketName: "demo-project.firebasestorage.app",
      storagePath: "buildmyresume/resumes/user_123/resume.pdf"
    });

    expect(getFirebaseStorageBucketMock).toHaveBeenCalledWith("demo-project.firebasestorage.app");
    expect(fileMock).toHaveBeenCalledWith("buildmyresume/resumes/user_123/resume.pdf");
    expect(result).toEqual(
      expect.objectContaining({
        buffer: expect.any(Buffer),
        contentType: "application/pdf",
        contentLength: "42"
      })
    );
  });

  it("builds direct Firebase signed read urls for resumes", async () => {
    const { getFirebaseResumeSignedReadUrl } = await import("../src/utils/firebase-storage.js");

    const result = await getFirebaseResumeSignedReadUrl({
      bucketName: "demo-project.firebasestorage.app",
      storagePath: "buildmyresume/resumes/user_123/resume.pdf",
      originalFileName: "resume.pdf",
      mimeType: "application/pdf"
    });

    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "v4",
        action: "read",
        responseType: "application/pdf"
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        url: "https://storage.googleapis.com/signed/resume.pdf",
        expiresAt: expect.any(Number)
      })
    );
  });

  it("resolves Firebase storage location from explicit fields and gs urls", async () => {
    const { resolveFirebaseResumeStorageLocation } = await import("../src/utils/firebase-storage.js");

    expect(
      resolveFirebaseResumeStorageLocation({
        firebaseStorageBucket: "demo-project.firebasestorage.app",
        firebaseStoragePath: "buildmyresume/resumes/user_123/resume.pdf"
      })
    ).toEqual({
      bucketName: "demo-project.firebasestorage.app",
      storagePath: "buildmyresume/resumes/user_123/resume.pdf"
    });

    expect(
      resolveFirebaseResumeStorageLocation({
        filePath: "gs://demo-project.firebasestorage.app/buildmyresume/resumes/user_123/resume.pdf"
      })
    ).toEqual({
      bucketName: "demo-project.firebasestorage.app",
      storagePath: "buildmyresume/resumes/user_123/resume.pdf"
    });
  });

  it("ignores missing Firebase files during delete cleanup", async () => {
    const { deleteResumeFromFirebaseStorage } = await import("../src/utils/firebase-storage.js");
    deleteMock.mockRejectedValueOnce({ code: 404 });

    await expect(
      deleteResumeFromFirebaseStorage({
        bucketName: "demo-project.firebasestorage.app",
        storagePath: "buildmyresume/resumes/user_123/resume.pdf"
      })
    ).resolves.toBeUndefined();
  });
});
