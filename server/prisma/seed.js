const { PrismaClient } = require("@prisma/client");
const data = require("./data.json");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.prescription.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.medicationOption.deleteMany();
  await prisma.dosageOption.deleteMany();

  for (const medication of data.medications) {
    await prisma.medicationOption.create({
      data: {
        name: medication,
      },
    });
  }

  for (const dosage of data.dosages) {
    await prisma.dosageOption.create({
      data: {
        value: dosage,
      },
    });
  }

  for (const user of data.users) {
    await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
        appointments: {
          create: user.appointments.map((appointment) => ({
            provider: appointment.provider,
            datetime: new Date(appointment.datetime),
            repeat: appointment.repeat,
            endDate: null,
          })),
        },
        prescriptions: {
          create: user.prescriptions.map((prescription) => ({
            medication: prescription.medication,
            dosage: prescription.dosage,
            quantity: prescription.quantity,
            refillOn: new Date(prescription.refill_on),
            refillSchedule: prescription.refill_schedule,
          })),
        },
      },
    });
  }

  console.log("Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });