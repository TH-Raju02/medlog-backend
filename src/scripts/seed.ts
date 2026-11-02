import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../database/mongo";
import { User } from "../modules/auth/auth.model";
import { Specialty } from "../modules/specialties/specialties.module";
import { Protocol } from "../modules/protocols/protocols.module";
import { logger } from "../utils/logger";

// Matches the specialty picker in the Figma "Change Specialty" dialog.
const specialties = [
  { name: "Internal Medicine", description: "Adult general medicine" },
  { name: "ICU", description: "Intensive care unit" },
  { name: "CCU", description: "Coronary care unit" },
  { name: "NICU", description: "Neonatal intensive care unit" },
  { name: "PICU", description: "Paediatric intensive care unit" },
  { name: "Oncology", description: "Cancer care" },
  { name: "Geriatric", description: "Care of older adults" },
  { name: "Cardiology", description: "Heart and vascular care" },
  { name: "Nephrology", description: "Kidney care" },
  { name: "Pediatric", description: "Children's health" },
];

const seed = async () => {
  await connectDatabase();

  const passwordHash = await bcrypt.hash("Admin123!", 12);
  const admin = await User.findOneAndUpdate(
    { email: "admin@medlog.app" },
    {
      firstName: "MedLog",
      lastName: "Admin",
      email: "admin@medlog.app",
      passwordHash,
      country: "Kuwait",
      countryCode: "KW",
      jobTitle: "Doctor",
      specialty: "Internal Medicine",
      role: "admin",
      isVerified: true,
    },
    { upsert: true, new: true }
  );

  const clinicianHash = await bcrypt.hash("Clinician123!", 12);
  await User.findOneAndUpdate(
    { email: "clinician@medlog.app" },
    {
      firstName: "Sara",
      lastName: "Al-Mutairi",
      email: "clinician@medlog.app",
      passwordHash: clinicianHash,
      country: "Kuwait",
      countryCode: "KW",
      jobTitle: "Pharmacist",
      specialty: "Internal Medicine",
      role: "clinician",
      isVerified: true,
    },
    { upsert: true, new: true }
  );

  for (const specialty of specialties) {
    await Specialty.findOneAndUpdate({ name: specialty.name }, specialty, {
      upsert: true,
      new: true,
    });
  }

  await Protocol.findOneAndUpdate(
    { title: "Sepsis Early Recognition" },
    {
      title: "Sepsis Early Recognition",
      category: "Critical Care",
      specialty: "Infectious Diseases",
      summary: "Hospital protocol for early sepsis screening and antibiotics.",
      content:
        "1. Screen for qSOFA.\n2. Obtain cultures before antibiotics when safe.\n3. Start broad-spectrum therapy within 1 hour for septic shock.\n4. Reassess at 48–72 hours.",
      tags: ["sepsis", "antibiotics"],
      isPublished: true,
      createdBy: admin._id,
    },
    { upsert: true, new: true }
  );

  logger.info("Seed completed", {
    admin: "admin@medlog.app / Admin123!",
    clinician: "clinician@medlog.app / Clinician123!",
  });

  await disconnectDatabase();
};

seed().catch(async (error) => {
  logger.error("Seed failed", { error });
  await disconnectDatabase();
  process.exit(1);
});
