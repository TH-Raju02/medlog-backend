import { z } from "zod";
import { admissionScopedRouter } from "./admissionScoped";
import {
  CultureResult,
  DTP_CATEGORIES,
  LabResult,
  MedicationReconciliation,
  Recommendation,
} from "./clinical.models";

const text = (max: number) => z.string().max(max).optional();

const clinicalPermissions = {
  read: "clinical:read",
  create: "clinical:create",
  update: "clinical:update",
  delete: "clinical:delete",
} as const;

export const reconciliationsRoutes = admissionScopedRouter({
  model: MedicationReconciliation,
  label: "Medication reconciliation",
  permissions: {
    read: "medications:read",
    create: "medications:create",
    update: "medications:update",
    delete: "medications:delete",
  },
  sort: { createdAt: -1 },
  fields: {
    drug: z.string().min(1).max(200),
    dose: text(120),
    route: text(80),
    frequency: text(120),
    discrepancy: text(300),
    comment: text(1000),
  },
});

export const recommendationsRoutes = admissionScopedRouter({
  model: Recommendation,
  label: "Recommendation",
  permissions: clinicalPermissions,
  sort: { recordedAt: -1, createdAt: -1 },
  fields: {
    text: z.string().min(1).max(2000),
    dtp: z.enum(DTP_CATEGORIES).optional(),
    recordedAt: z.coerce.date().optional(),
  },
});

export const labResultsRoutes = admissionScopedRouter({
  model: LabResult,
  label: "Lab result",
  permissions: clinicalPermissions,
  sort: { date: -1, createdAt: -1 },
  fields: {
    testName: z.string().min(1).max(200),
    date: z.coerce.date().optional(),
    reference: text(200),
    value: text(200),
  },
});

export const culturesRoutes = admissionScopedRouter({
  model: CultureResult,
  label: "Culture result",
  permissions: clinicalPermissions,
  sort: { collectedAt: -1, createdAt: -1 },
  fields: {
    cultureType: z.string().min(1).max(200),
    collectedAt: z.coerce.date().optional(),
    resultAt: z.coerce.date().optional(),
    organism: text(200),
    susceptibility: text(500),
  },
});
