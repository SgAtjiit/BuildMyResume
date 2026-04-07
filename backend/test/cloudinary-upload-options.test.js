import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadMock = vi.fn();
const configMock = vi.fn();
const urlMock = vi.fn();
const privateDownloadUrlMock = vi.fn();

vi.mock("cloudinary", () => ({
  v2: {
    config: configMock,
    uploader: {
      upload: uploadMock,
      destroy: vi.fn()
    },
    url: urlMock,
    utils: {
      private_download_url: privateDownloadUrlMock
    }
  }
}));

vi.mock("../src/config/env.js", () => ({
  env: {
    CLOUDINARY_CLOUD_NAME: "demo",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
    CLOUDINARY_RESUME_FOLDER: "buildmyresume/resumes"
  }
}));

describe("uploadResumeToCloudinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/raw/upload/v1/file.pdf" });
    urlMock.mockReturnValue("https://res.cloudinary.com/demo/raw/upload/s--signed--/v1/file.pdf");
    privateDownloadUrlMock.mockReturnValue("https://api.cloudinary.com/v1_1/demo/raw/download?signature=test");
  });

  it("uploads pdf files as raw documents", async () => {
    const { uploadResumeToCloudinary } = await import("../src/utils/cloudinary.js");

    await uploadResumeToCloudinary("C:/tmp/resume.pdf");

    expect(uploadMock).toHaveBeenCalledWith(
      "C:/tmp/resume.pdf",
      expect.objectContaining({
        resource_type: "raw",
        folder: "buildmyresume/resumes"
      })
    );
  });

  it("keeps image uploads on auto mode", async () => {
    const { uploadResumeToCloudinary } = await import("../src/utils/cloudinary.js");

    await uploadResumeToCloudinary("C:/tmp/resume.png");

    expect(uploadMock).toHaveBeenCalledWith(
      "C:/tmp/resume.png",
      expect.objectContaining({
        resource_type: "auto"
      })
    );
  });

  it("builds signed raw delivery URLs for pdf resumes even if an old image URL exists", async () => {
    const { getCloudinaryResumeUrl, resolveCloudinaryResumeResourceType } = await import("../src/utils/cloudinary.js");

    const resourceType = resolveCloudinaryResumeResourceType({
      cloudinaryUrl: "https://res.cloudinary.com/demo/image/upload/v1775566630/buildmyresume/resumes/resume.pdf",
      originalFileName: "resume.pdf",
      mimeType: "application/pdf"
    });
    const signedUrl = getCloudinaryResumeUrl({
      publicId: "buildmyresume/resumes/resume.pdf",
      resourceType
    });

    expect(resourceType).toBe("raw");
    expect(urlMock).toHaveBeenCalledWith(
      "buildmyresume/resumes/resume.pdf",
      expect.objectContaining({
        secure: true,
        type: "upload",
        resource_type: "raw",
        sign_url: true
      })
    );
    expect(signedUrl).toBe("https://res.cloudinary.com/demo/raw/upload/s--signed--/v1/file.pdf");
  });

  it("still signs pdf delivery URLs when Cloudinary reports image resource type", async () => {
    const { getCloudinaryResumeUrl } = await import("../src/utils/cloudinary.js");

    getCloudinaryResumeUrl({
      publicId: "buildmyresume/resumes/resume.pdf",
      resourceType: "image"
    });

    expect(urlMock).toHaveBeenCalledWith(
      "buildmyresume/resumes/resume.pdf",
      expect.objectContaining({
        resource_type: "image",
        sign_url: true
      })
    );
  });

  it("builds private download URLs for pdf resumes", async () => {
    const { getCloudinaryResumeDownloadUrl } = await import("../src/utils/cloudinary.js");

    const downloadUrl = getCloudinaryResumeDownloadUrl({
      publicId: "buildmyresume/resumes/resume.pdf",
      resourceType: "raw",
      originalFileName: "resume.pdf",
      mimeType: "application/pdf"
    });

    expect(privateDownloadUrlMock).toHaveBeenCalledWith(
      "buildmyresume/resumes/resume",
      "pdf",
      expect.objectContaining({
        resource_type: "raw",
        type: "upload",
        attachment: false
      })
    );
    expect(downloadUrl).toBe("https://api.cloudinary.com/v1_1/demo/raw/download?signature=test");
  });

  it("keeps the stored image resource type when creating a private download URL for legacy pdf assets", async () => {
    const { getCloudinaryResumeDownloadUrl } = await import("../src/utils/cloudinary.js");

    getCloudinaryResumeDownloadUrl({
      publicId: "buildmyresume/resumes/legacy-resume",
      resourceType: "image",
      originalFileName: "legacy-resume.pdf",
      mimeType: "application/pdf"
    });

    expect(privateDownloadUrlMock).toHaveBeenCalledWith(
      "buildmyresume/resumes/legacy-resume",
      "pdf",
      expect.objectContaining({
        resource_type: "image"
      })
    );
  });
});
