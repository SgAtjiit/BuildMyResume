import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { User } from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { Portfolio } from "../models/portfolio.models.js";
import { generatePortfolio } from "./generatePortfolio.js";
import { attachCustomDomain, deployPortfolio } from "./deployToCloudflare.js";

const createLogger = (traceId = "") => {
  const format = (event, payload = {}) => ({
    traceId,
    event,
    ...payload
  });

  return {
    info: (event, payload) => console.info("[portfolioService]", format(event, payload)),
    error: (event, payload) => console.error("[portfolioService]", format(event, payload))
  };
};

const slugify = (value) =>
  String(value || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "user";

const db = {
  users: {
    async findById(id) {
      const user = mongoose.isValidObjectId(id)
        ? await User.findById(id).lean()
        : await User.findOne({ firebaseUid: id }).lean();

      if (!user) {
        return null;
      }

      const projects = await Project.find({ owner: user._id }).sort({ updatedAt: -1 }).lean();
      return {
        ...user,
        projects
      };
    }
  },
  portfolios: {
    async findByUserId(userId) {
      return Portfolio.findOne({ userId }).lean();
    },
    async create(payload) {
      return Portfolio.create(payload);
    },
    async update(id, payload) {
      return Portfolio.findByIdAndUpdate(id, payload, { new: true });
    }
  }
};

export const publishPortfolio = async (userId, userPreference = "", customDomain = "", options = {}) => {
  const logger = createLogger(options.traceId || "");
  const startedAt = Date.now();

  logger.info("publish:start", {
    userId,
    hasPreference: Boolean(String(userPreference || "").trim()),
    hasCustomDomain: Boolean(String(customDomain || "").trim())
  });

  const user = await db.users.findById(userId);

  if (!user) {
    logger.error("user:not-found", { userId });
    throw new Error("User not found");
  }

  logger.info("user:loaded", {
    mongoUserId: String(user._id),
    email: user.email || null,
    projectCount: Array.isArray(user.projects) ? user.projects.length : 0
  });

  let record = await db.portfolios.findByUserId(user._id);

  if (!record) {
    const slug = `${slugify(user.displayName || user.email || "portfolio")}-${nanoid(6).toLowerCase()}`;
    logger.info("portfolio:creating-record", { projectName: slug });

    record = await db.portfolios.create({
      userId: user._id,
      projectName: slug
    });
  } else {
    logger.info("portfolio:existing-record", {
      portfolioId: String(record._id || record.id),
      projectName: record.projectName
    });
  }

  const html = await generatePortfolio(user, userPreference || "", {
    traceId: options.traceId || ""
  });

  logger.info("portfolio:html-generated", {
    htmlLength: html.length,
    projectName: record.projectName
  });

  const url = await deployPortfolio(record.projectName, html, {
    traceId: options.traceId || ""
  });

  logger.info("portfolio:deployed", {
    projectName: record.projectName,
    url
  });

  let domainInfo = null;
  if (customDomain && String(customDomain).trim()) {
    domainInfo = await attachCustomDomain(record.projectName, String(customDomain).trim(), {
      traceId: options.traceId || ""
    });

    logger.info("portfolio:domain-attached", {
      domain: domainInfo?.domain || customDomain,
      status: domainInfo?.status || null
    });
  }

  await db.portfolios.update(record._id || record.id, {
    url,
    userPreference: userPreference || "",
    customDomain: customDomain || "",
    publishedAt: new Date()
  });

  logger.info("publish:done", {
    portfolioId: String(record._id || record.id),
    projectName: record.projectName,
    url,
    durationMs: Date.now() - startedAt
  });

  return {
    url,
    domainInfo
  };
};
