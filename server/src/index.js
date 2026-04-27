const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Zealthy EMR API is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "zealthy-emr-api",
  });
});

// Patient login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        appointments: true,
        prescriptions: true,
      },
    });

    if (!user || user.password !== password) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    res.json({
      message: "Login successful",
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Something went wrong during login",
    });
  }
});

// Get medication and dosage dropdown options
app.get("/api/options", async (req, res) => {
  try {
    const medications = await prisma.medicationOption.findMany({
      orderBy: { name: "asc" },
    });

    const dosages = await prisma.dosageOption.findMany({
      orderBy: { value: "asc" },
    });

    res.json({
      medications,
      dosages,
    });
  } catch (error) {
    console.error("Options error:", error);
    res.status(500).json({
      message: "Failed to fetch options",
    });
  }
});

// Get all patients
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      include: {
        appointments: true,
        prescriptions: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      message: "Failed to fetch users",
    });
  }
});

// Get one patient by ID
app.get("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { datetime: "asc" },
        },
        prescriptions: {
          orderBy: { refillOn: "asc" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      message: "Failed to fetch user",
    });
  }
});

// Create new patient
app.post("/api/users", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "A patient with this email already exists",
      });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      message: "Failed to create user",
    });
  }
});

// Update patient
app.put("/api/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, password } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        password,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      message: "Failed to update user",
    });
  }
});

// Get all appointments for a patient
app.get("/api/users/:userId/appointments", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const appointments = await prisma.appointment.findMany({
      where: { userId },
      orderBy: { datetime: "asc" },
    });

    res.json(appointments);
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
});

// Create appointment for a patient
app.post("/api/users/:userId/appointments", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { provider, datetime, repeat, endDate } = req.body;

    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!provider || !datetime || !repeat) {
      return res.status(400).json({
        message: "Provider, datetime, and repeat schedule are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const appointment = await prisma.appointment.create({
      data: {
        provider,
        datetime: new Date(datetime),
        repeat,
        endDate: endDate ? new Date(endDate) : null,
        userId,
      },
    });

    res.status(201).json(appointment);
  } catch (error) {
    console.error("Create appointment error:", error);
    res.status(500).json({ message: "Failed to create appointment" });
  }
});

// Update appointment
app.put("/api/appointments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { provider, datetime, repeat, endDate } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!existingAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        provider,
        datetime: datetime ? new Date(datetime) : existingAppointment.datetime,
        repeat,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    res.json(appointment);
  } catch (error) {
    console.error("Update appointment error:", error);
    res.status(500).json({ message: "Failed to update appointment" });
  }
});

// Delete appointment
app.delete("/api/appointments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!existingAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    await prisma.appointment.delete({
      where: { id },
    });

    res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    console.error("Delete appointment error:", error);
    res.status(500).json({ message: "Failed to delete appointment" });
  }
});

// Get all prescriptions for a patient
app.get("/api/users/:userId/prescriptions", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { userId },
      orderBy: { refillOn: "asc" },
    });

    res.json(prescriptions);
  } catch (error) {
    console.error("Get prescriptions error:", error);
    res.status(500).json({ message: "Failed to fetch prescriptions" });
  }
});

// Create prescription for a patient
app.post("/api/users/:userId/prescriptions", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { medication, dosage, quantity, refillOn, refillSchedule } = req.body;

    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!medication || !dosage || !quantity || !refillOn || !refillSchedule) {
      return res.status(400).json({
        message:
          "Medication, dosage, quantity, refill date, and refill schedule are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const prescription = await prisma.prescription.create({
      data: {
        medication,
        dosage,
        quantity: Number(quantity),
        refillOn: new Date(refillOn),
        refillSchedule,
        userId,
      },
    });

    res.status(201).json(prescription);
  } catch (error) {
    console.error("Create prescription error:", error);
    res.status(500).json({ message: "Failed to create prescription" });
  }
});

// Update prescription
app.put("/api/prescriptions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { medication, dosage, quantity, refillOn, refillSchedule } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid prescription ID" });
    }

    const existingPrescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!existingPrescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: {
        medication,
        dosage,
        quantity: quantity ? Number(quantity) : existingPrescription.quantity,
        refillOn: refillOn ? new Date(refillOn) : existingPrescription.refillOn,
        refillSchedule,
      },
    });

    res.json(prescription);
  } catch (error) {
    console.error("Update prescription error:", error);
    res.status(500).json({ message: "Failed to update prescription" });
  }
});

// Delete prescription
app.delete("/api/prescriptions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid prescription ID" });
    }

    const existingPrescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!existingPrescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    await prisma.prescription.delete({
      where: { id },
    });

    res.json({ message: "Prescription deleted successfully" });
  } catch (error) {
    console.error("Delete prescription error:", error);
    res.status(500).json({ message: "Failed to delete prescription" });
  }
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;