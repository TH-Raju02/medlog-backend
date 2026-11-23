import fs from "fs";
import path from "path";
import { Readable } from "stream";
import jwt from "jsonwebtoken";
import mongoose, { Types } from "mongoose";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { IReference, Reference } from "./references.model";

/** Files uploaded before GridFS storage were written here; they are still served when present. */
export const referencesDir = path.resolve(process.cwd(), env.UPLOAD_DIR, "references");

const LINK_TTL = "10m";

// PDFs live in MongoDB (GridFS) so they survive restarts of hosts with an ephemeral disk, such as Render.
const bucket = () => {
  const db = mongoose.connection.db;
  if (!db) throw new ApiError(503, "Database is not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "referenceFiles" });
};

const removeStoredFile = async (file?: IReference["file"]) => {
  if (!file) return;
  try {
    if (file.gridFsId) {
      await bucket().delete(new Types.ObjectId(String(file.gridFsId)));
    } else if (file.storedName) {
      await fs.promises.unlink(path.join(referencesDir, path.basename(file.storedName)));
    }
  } catch (error) {
    logger.warn("Could not remove reference file", { error: (error as Error).message });
  }
};

const saveToGridFs = (buffer: Buffer, filename: string, mimeType: string) =>
  new Promise<Types.ObjectId>((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { metadata: { contentType: mimeType } });
    Readable.from(buffer)
      .pipe(upload)
      .on("error", reject)
      .on("finish", () => resolve(upload.id as Types.ObjectId));
  });

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

  /** Every folder with its full path ("Antibiotics / Renal"), for the "Move to folder" picker. */
  async folders() {
    const folders = await Reference.find({ kind: "folder" }).select("name parent").lean();
    const byId = new Map(folders.map((f) => [String(f._id), f]));
    const pathOf = (id: string): string => {
      const names: string[] = [];
      let current = byId.get(id);
      const seen = new Set<string>();
      while (current && !seen.has(String(current._id))) {
        seen.add(String(current._id));
        names.unshift(current.name);
        current = current.parent ? byId.get(String(current.parent)) : undefined;
      }
      return names.join(" / ");
    };
    return folders
      .map((f) => ({ _id: String(f._id), name: f.name, parent: f.parent ? String(f.parent) : null, path: pathOf(String(f._id)) }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  private async assertFolder(parentId?: string | null) {
    if (!parentId) return null;
    const folder = await Reference.findOne({ _id: parentId, kind: "folder" });
    if (!folder) throw new ApiError(404, "Folder not found");
    return folder._id as Types.ObjectId;
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
    const parent = await this.assertFolder(parentId);
    const gridFsId = await saveToGridFs(file.buffer, file.originalname, file.mimetype);
    try {
      const displayName = (name || file.originalname).replace(/\.pdf$/i, "").trim() || "Document";
      return await Reference.create({
        name: displayName,
        kind: "file",
        parent,
        file: {
          gridFsId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
        createdBy: new Types.ObjectId(userId),
      });
    } catch (error) {
      await removeStoredFile({ gridFsId, originalName: "", mimeType: "", size: 0 });
      throw error;
    }
  }

  /** Moves a file or folder into another folder (or to the top level when `parentId` is null). */
  async move(id: string, parentId: string | null) {
    const item = await Reference.findById(id);
    if (!item) throw new ApiError(404, "Item not found");
    const target = await this.assertFolder(parentId);

    if (target && item.kind === "folder") {
      // A folder cannot be moved into itself or into one of its own subfolders.
      let cursor: Types.ObjectId | null = target;
      while (cursor) {
        if (cursor.equals(item._id as Types.ObjectId)) {
          throw new ApiError(400, "A folder cannot be moved into itself", { code: "INVALID_MOVE" });
        }
        const parent: { parent?: Types.ObjectId | null } | null = await Reference.findById(cursor)
          .select("parent")
          .lean();
        cursor = parent?.parent ?? null;
      }
    }

    item.parent = target;
    await item.save();
    return item;
  }

  async remove(id: string) {
    const root = await Reference.findById(id);
    if (!root) throw new ApiError(404, "Item not found");

    const ids: Types.ObjectId[] = [root._id as Types.ObjectId];
    const files: NonNullable<IReference["file"]>[] = [];
    if (root.file) files.push(root.file);

    let frontier = root.kind === "folder" ? [root._id] : [];
    while (frontier.length) {
      const children = await Reference.find({ parent: { $in: frontier } });
      for (const child of children) {
        ids.push(child._id as Types.ObjectId);
        if (child.file) files.push(child.file);
      }
      frontier = children.filter((c) => c.kind === "folder").map((c) => c._id);
    }

    await Reference.deleteMany({ _id: { $in: ids } });
    await Promise.all(files.map(removeStoredFile));
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

  /** Resolves a signed link to a readable PDF stream. */
  async openLink(token: string): Promise<{ item: IReference; stream: Readable; size?: number }> {
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
    const missing = () =>
      new ApiError(404, "This file is no longer available. Please upload it again.", { code: "FILE_MISSING" });
    if (!item?.file) throw missing();

    if (item.file.gridFsId) {
      const id = new Types.ObjectId(String(item.file.gridFsId));
      const [stored] = await bucket().find({ _id: id }).toArray();
      if (!stored) throw missing();
      return { item, stream: bucket().openDownloadStream(id), size: stored.length };
    }

    const filePath = item.file.storedName
      ? path.join(referencesDir, path.basename(item.file.storedName))
      : "";
    if (!filePath || !fs.existsSync(filePath)) throw missing();
    return { item, stream: fs.createReadStream(filePath), size: fs.statSync(filePath).size };
  }
}

export const referencesService = new ReferencesService();
