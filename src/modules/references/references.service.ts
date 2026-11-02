import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { Reference } from "./references.model";

export const referencesDir = path.resolve(process.cwd(), env.UPLOAD_DIR, "references");
fs.mkdirSync(referencesDir, { recursive: true });

export const newStoredName = () => `${crypto.randomBytes(16).toString("hex")}.pdf`;

const LINK_TTL = "10m";

const removeStoredFile = (storedName?: string) => {
  if (!storedName) return;
  fs.promises.unlink(path.join(referencesDir, path.basename(storedName))).catch((error) => {
    logger.warn("Could not remove reference file", { error: error.message });
  });
};

export class ReferencesService {
  async list(parentId?: string) {
    const items = await Reference.find({ parent: parentId ? new Types.ObjectId(parentId) : null }).sort({
      kind: 1,
      createdAt: -1,
    });
    let folder = null;
    if (parentId) {
      folder = await Reference.findOne({ _id: parentId, kind: "folder" });
      if (!folder) throw new ApiError(404, "Folder not found");
    }
    return { folder, items };
  }

  private async assertFolder(parentId?: string) {
    if (!parentId) return null;
    const folder = await Reference.findOne({ _id: parentId, kind: "folder" });
    if (!folder) throw new ApiError(404, "Folder not found");
    return folder._id;
  }

  async createFolder(name: string, parentId: string | undefined, userId: string) {
    const parent = await this.assertFolder(parentId);
    return Reference.create({
      name,
      kind: "folder",
      parent,
      createdBy: new Types.ObjectId(userId),
    });
  }

  async createFile(
    file: Express.Multer.File,
    name: string | undefined,
    parentId: string | undefined,
    userId: string
  ) {
    try {
      const parent = await this.assertFolder(parentId);
      const displayName = (name || file.originalname).replace(/\.pdf$/i, "").trim() || "Document";
      return await Reference.create({
        name: displayName,
        kind: "file",
        parent,
        file: {
          storedName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
        createdBy: new Types.ObjectId(userId),
      });
    } catch (error) {
      removeStoredFile(file.filename);
      throw error;
    }
  }

  async remove(id: string) {
    const root = await Reference.findById(id);
    if (!root) throw new ApiError(404, "Item not found");

    const ids: Types.ObjectId[] = [root._id as Types.ObjectId];
    const storedNames: string[] = [];
    if (root.file?.storedName) storedNames.push(root.file.storedName);

    let frontier = root.kind === "folder" ? [root._id] : [];
    while (frontier.length) {
      const children = await Reference.find({ parent: { $in: frontier } });
      for (const child of children) {
        ids.push(child._id as Types.ObjectId);
        if (child.file?.storedName) storedNames.push(child.file.storedName);
      }
      frontier = children.filter((c) => c.kind === "folder").map((c) => c._id);
    }

    await Reference.deleteMany({ _id: { $in: ids } });
    storedNames.forEach(removeStoredFile);
    return { deleted: ids.length };
  }

  async createLink(id: string, apiBaseUrl: string) {
    const item = await Reference.findOne({ _id: id, kind: "file" });
    if (!item) throw new ApiError(404, "File not found");
    const token = jwt.sign({ sub: item.id, type: "reference-file" }, env.JWT_ACCESS_SECRET, {
      expiresIn: LINK_TTL,
    } as jwt.SignOptions);
    const base = `${apiBaseUrl}/references/files/${token}`;
    return { viewUrl: base, downloadUrl: `${base}?download=1`, expiresIn: LINK_TTL };
  }

  async resolveLink(token: string) {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    } catch {
      throw new ApiError(401, "Link expired", { code: "UNAUTHORIZED" });
    }
    if (payload.type !== "reference-file" || !payload.sub) {
      throw new ApiError(401, "Invalid link", { code: "UNAUTHORIZED" });
    }
    const item = await Reference.findOne({ _id: payload.sub, kind: "file" });
    if (!item?.file?.storedName) throw new ApiError(404, "File not found");
    return {
      item,
      filePath: path.join(referencesDir, path.basename(item.file.storedName)),
    };
  }
}

export const referencesService = new ReferencesService();
