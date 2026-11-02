import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { aiLimiter } from "../../middlewares/rateLimiter";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "text/plain",
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});

const router = Router();
router.use(authenticate);

/**
 * Simulated AI/OCR extraction — returns structured draft fields
 * derived from filename/text content for demo integration.
 */
router.post(
  "/extract",
  aiLimiter,
  authorize("ai:extract"),
  upload.single("document"),
  asyncHandler(async (req, res) => {
    if (!req.file && !req.body?.text) {
      throw new ApiError(400, "Document file or text is required");
    }

    const sourceText =
      req.body?.text ||
      (req.file?.mimetype === "text/plain"
        ? req.file.buffer.toString("utf8")
        : req.file?.originalname || "");

    const draft = {
      entryMode: "ai" as const,
      patient: {
        firstName: extract(sourceText, /first\s*name[:\s]+([A-Za-z]+)/i) || "Unknown",
        lastName: extract(sourceText, /last\s*name[:\s]+([A-Za-z]+)/i) || "Patient",
        nationalId: extract(sourceText, /(civil|national)\s*id[:\s]+([A-Za-z0-9-]+)/i, 2),
      },
      chiefComplaint:
        extract(sourceText, /chief\s*complaint[:\s]+(.+)/i) ||
        "Extracted clinical presentation pending review",
      diagnosis: extract(sourceText, /diagnosis[:\s]+(.+)/i),
      specialty: extract(sourceText, /specialty[:\s]+(.+)/i) || "Internal Medicine",
      ward: extract(sourceText, /ward[:\s]+([A-Za-z0-9-]+)/i),
      room: extract(sourceText, /room[:\s]+([A-Za-z0-9-]+)/i),
      bed: extract(sourceText, /bed[:\s]+([A-Za-z0-9-]+)/i),
      clinicalParameters: [
        {
          parameter: extract(sourceText, /parameter[:\s]+(.+)/i) || "Vitals review",
          valueGoal: extract(sourceText, /value[:\s]+(.+)/i),
          planRecommendation: extract(sourceText, /plan[:\s]+(.+)/i),
        },
      ],
      labResults: extractLabResults(sourceText),
      cultures: extractCultures(sourceText),
      confidence: req.file ? 0.72 : 0.65,
      source: {
        filename: req.file?.originalname,
        mimeType: req.file?.mimetype,
        size: req.file?.size,
      },
    };

    return sendSuccess(res, draft, "Document extracted");
  })
);

const reportDate = (text: string) => {
  const match = /date[:\s]+(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i.exec(text);
  if (!match) return undefined;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/** Text reports only: lines such as "Creatinine: 1.4 mg/dL (0.6-1.2 mg/dL)". */
function extractLabResults(text: string) {
  const date = reportDate(text);
  const rows: Array<{ testName: string; value: string; reference?: string; date?: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z][A-Za-z .]{1,40}?)\s*[:=]\s*([\d.]+\s*[^\s(]*)\s*(?:\(([^)]+)\))?\s*$/.exec(line);
    if (!match || /culture|date|name|ward|room|bed/i.test(match[1])) continue;
    rows.push({ testName: match[1].trim(), value: match[2].trim(), reference: match[3]?.trim(), date });
  }
  return rows.slice(0, 50);
}

/** Text reports only: lines such as "Blood Culture: Escherichia coli - Sensitive to Ceftriaxone". */
function extractCultures(text: string) {
  const date = reportDate(text);
  const rows: Array<{ cultureType: string; organism?: string; susceptibility?: string; collectedAt?: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z ]*culture)\s*[:=]\s*([^-–]+)(?:[-–]\s*(.+))?$/i.exec(line);
    if (!match) continue;
    rows.push({
      cultureType: match[1].trim(),
      organism: match[2].trim(),
      susceptibility: match[3]?.trim(),
      collectedAt: date,
    });
  }
  return rows.slice(0, 50);
}

function extract(text: string, regex: RegExp, group = 1): string | undefined {
  const match = regex.exec(text);
  return match?.[group]?.trim();
}

export default router;
