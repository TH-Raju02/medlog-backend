import fs from "fs";
import { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { referencesService } from "./references.service";

const apiBaseUrl = (req: Request) =>
  (env.PUBLIC_API_URL ? env.PUBLIC_API_URL.replace(/\/+$/, "") : `${req.protocol}://${req.get("host")}`) +
  "/api/v1";

export const referencesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await referencesService.list(req.query.parentId as string | undefined);
    return sendSuccess(res, result, "References loaded");
  }),

  createFolder: asyncHandler(async (req: Request, res: Response) => {
    const folder = await referencesService.createFolder(
      req.body.name,
      req.body.parentId,
      req.user!.id
    );
    return sendSuccess(res, folder, "Folder created", 201);
  }),

  upload: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new ApiError(400, "A PDF file is required");
    const item = await referencesService.createFile(
      req.file,
      req.body.name,
      req.body.parentId,
      req.user!.id
    );
    return sendSuccess(res, item, "File uploaded", 201);
  }),

  link: asyncHandler(async (req: Request, res: Response) => {
    const link = await referencesService.createLink(req.params.id, apiBaseUrl(req));
    return sendSuccess(res, link, "Link created");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = await referencesService.remove(req.params.id);
    return sendSuccess(res, result, "Deleted");
  }),

  serveFile: asyncHandler(async (req: Request, res: Response) => {
    const { item, filePath } = await referencesService.resolveLink(req.params.token);
    if (!fs.existsSync(filePath)) throw new ApiError(404, "File not found");
    const filename = `${item.name.replace(/[^\w\- ]+/g, "").trim() || "document"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${req.query.download === "1" ? "attachment" : "inline"}; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "private, no-store");
    fs.createReadStream(filePath).pipe(res);
  }),
};
