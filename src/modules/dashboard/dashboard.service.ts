import { Types } from "mongoose";
import { ownedAdmissionFilter, ownedAdmissionIds, ownedPatientFilter } from "../../utils/ownership";
import { Admission } from "../admissions/admissions.model";
import { Patient } from "../patients/patients.model";
import { Transfer } from "../transfers/transfers.model";
import { MedicationReconciliation, Recommendation } from "../clinical/clinical.models";

const monthRange = (month?: string) => {
  const now = new Date();
  const [year, monthIndex] = month
    ? month.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 1);
  return { start, end, key: `${year}-${String(monthIndex).padStart(2, "0")}` };
};

export class DashboardService {
  async metrics(userId: string, month?: string) {
    const { start, end, key } = monthRange(month);
    const inMonth = { $gte: start, $lt: end };
    const mine = ownedAdmissionFilter(userId);
    const myAdmissions = { admission: { $in: await ownedAdmissionIds(userId) } };

    const [
      medicationReconciliation,
      drugTherapyProblems,
      dischargeCounseling,
      casesThisMonth,
      activeAdmissions,
      patientsCount,
      pendingTransfers,
      currentAdmissions,
      specialtyBreakdown,
    ] = await Promise.all([
      MedicationReconciliation.countDocuments({ ...myAdmissions, createdAt: inMonth }),
      Recommendation.countDocuments({ ...myAdmissions, dtp: { $ne: "none" }, recordedAt: inMonth }),
      Admission.countDocuments({ ...mine, dischargeCounseling: true, dischargedAt: inMonth }),
      Admission.countDocuments({ ...mine, admissionDate: inMonth }),
      Admission.countDocuments({ ...mine, status: "active" }),
      Patient.countDocuments(ownedPatientFilter(userId)),
      Transfer.countDocuments({ toUser: new Types.ObjectId(userId), status: "pending" }),
      Admission.find({ ...mine, status: "active" })
        .populate("patient")
        .sort({ admissionDate: -1, createdAt: -1 })
        .limit(50),
      Admission.aggregate([
        { $match: { ...mine, status: "active" } },
        { $group: { _id: "$specialty", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      month: key,
      monthStart: start,
      monthEnd: new Date(end.getTime() - 1),
      medicationReconciliation,
      drugTherapyProblems,
      dischargeCounseling,
      casesThisMonth,
      currentAdmissions,
      // Kept for older app builds.
      activeAdmissions,
      patientsCount,
      pendingTransfers,
      recentAdmissions: currentAdmissions.slice(0, 8),
      specialtyBreakdown: specialtyBreakdown.map((s) => ({
        specialty: s._id || "Unspecified",
        count: s.count,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
