import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const listReferencesSchema = z.object({
  query: z.object({
    parentId: objectId.optional(),
  }),
});

export const createFolderSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    parentId: objectId.optional(),
  }),
});

export const uploadFileSchema = z.object({
  body: z.object({
    name: z.string().trim().max(160).optional(),
    parentId: objectId.optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const fileTokenSchema = z.object({
  params: z.object({ token: z.string().min(20).max(1000) }),
  query: z.object({ download: z.enum(["0", "1"]).optional() }),
});
