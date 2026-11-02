import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import patientsRoutes from "../modules/patients/patients.routes";
import admissionsRoutes from "../modules/admissions/admissions.routes";
import clinicalParametersRoutes from "../modules/clinicalParameters/clinicalParameters.module";
import medicationsRoutes from "../modules/medications/medications.module";
import antibioticsRoutes from "../modules/antibiotics/antibiotics.module";
import protocolsRoutes from "../modules/protocols/protocols.module";
import specialtiesRoutes from "../modules/specialties/specialties.module";
import transfersRoutes from "../modules/transfers/transfers.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import aiExtractionRoutes from "../modules/aiExtraction/aiExtraction.module";
import usersRoutes from "../modules/users/users.routes";
import subscriptionsRoutes from "../modules/subscriptions/subscriptions.routes";
import remindersRoutes from "../modules/reminders/reminders.routes";
import referencesRoutes from "../modules/references/references.routes";
import {
  culturesRoutes,
  labResultsRoutes,
  reconciliationsRoutes,
  recommendationsRoutes,
} from "../modules/clinical/clinical.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "MedLog API healthy", data: { status: "ok" } });
});

router.use("/auth", authRoutes);
router.use("/patients", patientsRoutes);
router.use("/admissions", admissionsRoutes);
router.use("/clinical-parameters", clinicalParametersRoutes);
router.use("/medications", medicationsRoutes);
router.use("/medication-reconciliations", reconciliationsRoutes);
router.use("/antibiotics", antibioticsRoutes);
router.use("/recommendations", recommendationsRoutes);
router.use("/lab-results", labResultsRoutes);
router.use("/cultures", culturesRoutes);
router.use("/protocols", protocolsRoutes);
router.use("/references", referencesRoutes);
router.use("/specialties", specialtiesRoutes);
router.use("/transfers", transfersRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reminders", remindersRoutes);
router.use("/subscriptions", subscriptionsRoutes);
router.use("/ai", aiExtractionRoutes);
router.use("/users", usersRoutes);

export default router;
