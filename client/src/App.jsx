import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "./api";

function getStoredPatientId() {
  return localStorage.getItem("patientId");
}

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function formatForDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function formatForDateInput(value) {
  if (!value) return "";

  return new Date(value).toISOString().slice(0, 10);
}

function isWithinNextDays(value, days) {
  const date = new Date(value);
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + days);

  return date >= now && date <= future;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date, months) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function expandAppointmentOccurrences(appointments, monthsAhead = 3) {
  const now = new Date();
  const endWindow = addMonths(now, monthsAhead);
  const results = [];

  appointments.forEach((appointment) => {
    let currentDate = new Date(appointment.datetime);
    const appointmentEndDate = appointment.endDate
      ? new Date(appointment.endDate)
      : endWindow;

    while (currentDate < now) {
      if (appointment.repeat === "weekly") {
        currentDate = addDays(currentDate, 7);
      } else if (appointment.repeat === "monthly") {
        currentDate = addMonths(currentDate, 1);
      } else {
        break;
      }
    }

    while (currentDate <= endWindow && currentDate <= appointmentEndDate) {
      if (currentDate >= now) {
        results.push({
          ...appointment,
          occurrenceDate: currentDate.toISOString(),
        });
      }

      if (appointment.repeat === "weekly") {
        currentDate = addDays(currentDate, 7);
      } else if (appointment.repeat === "monthly") {
        currentDate = addMonths(currentDate, 1);
      } else {
        break;
      }
    }
  });

  return results.sort(
    (a, b) => new Date(a.occurrenceDate) - new Date(b.occurrenceDate)
  );
}

function expandRefillOccurrences(prescriptions, monthsAhead = 3) {
  const now = new Date();
  const endWindow = addMonths(now, monthsAhead);
  const results = [];

  prescriptions.forEach((prescription) => {
    let currentDate = new Date(prescription.refillOn);

    while (currentDate < now) {
      if (prescription.refillSchedule === "weekly") {
        currentDate = addDays(currentDate, 7);
      } else if (prescription.refillSchedule === "monthly") {
        currentDate = addMonths(currentDate, 1);
      } else {
        break;
      }
    }

    while (currentDate <= endWindow) {
      if (currentDate >= now) {
        results.push({
          ...prescription,
          occurrenceDate: currentDate.toISOString(),
        });
      }

      if (prescription.refillSchedule === "weekly") {
        currentDate = addDays(currentDate, 7);
      } else if (prescription.refillSchedule === "monthly") {
        currentDate = addMonths(currentDate, 1);
      } else {
        break;
      }
    }
  });

  return results.sort(
    (a, b) => new Date(a.occurrenceDate) - new Date(b.occurrenceDate)
  );
}

function LoginPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "mark@some-email-provider.net",
    password: "Password123!",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/login", formData);

      localStorage.setItem("patientId", response.data.user.id);
      navigate("/portal");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page center-page">
      <div className="card login-card">
        <h1>Patient Portal</h1>
        <p className="muted">
          Login to view upcoming appointments and medication refills.
        </p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Email
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="sample-login">
          <p>Sample login:</p>
          <code>mark@some-email-provider.net</code>
          <code>Password123!</code>
        </div>

        <Link to="/admin" className="admin-link">
          Go to Admin EMR
        </Link>
      </div>
    </div>
  );
}

function PortalHome() {
  const navigate = useNavigate();
  const patientId = getStoredPatientId();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPatient() {
      if (!patientId) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/api/users/${patientId}`);
        setPatient(response.data);
      } catch (error) {
        console.error("Failed to fetch patient", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPatient();
  }, [patientId]);

  function handleLogout() {
    localStorage.removeItem("patientId");
    navigate("/");
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading portal...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page center-page">
        <div className="card">
          <h2>Please login first</h2>
          <Link to="/">Back to login</Link>
        </div>
      </div>
    );
  }

  const appointmentOccurrences = expandAppointmentOccurrences(
    patient.appointments,
    3
  );

  const refillOccurrences = expandRefillOccurrences(patient.prescriptions, 3);

  const upcomingAppointments = appointmentOccurrences.filter((appointment) =>
    isWithinNextDays(appointment.occurrenceDate, 7)
  );

  const upcomingRefills = refillOccurrences.filter((prescription) =>
    isWithinNextDays(prescription.occurrenceDate, 7)
  );

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Welcome, {patient.name}</h1>
          <p className="muted">{patient.email}</p>
        </div>

        <div className="actions">
          <Link to="/admin">Admin EMR</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <section className="card patient-info">
        <h2>Basic Patient Info</h2>
        <div className="info-grid">
          <p>
            <strong>Name:</strong> {patient.name}
          </p>
          <p>
            <strong>Email:</strong> {patient.email}
          </p>
          <p>
            <strong>Total Appointments:</strong> {patient.appointments.length}
          </p>
          <p>
            <strong>Total Prescriptions:</strong>{" "}
            {patient.prescriptions.length}
          </p>
        </div>
      </section>

      <div className="grid two-columns">
        <section className="card">
          <h2>Appointments in Next 7 Days</h2>

          {upcomingAppointments.length === 0 ? (
            <p className="muted">No appointments scheduled in the next 7 days.</p>
          ) : (
            <ul className="list">
              {upcomingAppointments.map((appointment) => (
                <li key={appointment.id}>
                  <strong>{appointment.provider}</strong>
                  <span>{formatDateTime(appointment.occurrenceDate)}</span>
                  <small>Repeats: {appointment.repeat}</small>
                </li>
              ))}
            </ul>
          )}

          <Link to="/appointments">View full appointment schedule</Link>
        </section>

        <section className="card">
          <h2>Refills in Next 7 Days</h2>

          {upcomingRefills.length === 0 ? (
            <p className="muted">No medication refills in the next 7 days.</p>
          ) : (
            <ul className="list">
              {upcomingRefills.map((prescription) => (
                <li key={prescription.id}>
                  <strong>
                    {prescription.medication} {prescription.dosage}
                  </strong>
                  <span>Refill on: {formatDate(prescription.occurrenceDate)}</span>
                  <small>Quantity: {prescription.quantity}</small>
                </li>
              ))}
            </ul>
          )}

          <Link to="/prescriptions">View all prescriptions</Link>
        </section>
      </div>
    </div>
  );
}

function AppointmentSchedulePage() {
  const patientId = getStoredPatientId();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      if (!patientId) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/api/users/${patientId}/appointments`);
        setAppointments(response.data);
      } catch (error) {
        console.error("Failed to fetch appointments", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, [patientId]);

  if (!patientId) {
    return (
      <div className="page">
        <div className="card">
          <h2>Please login first</h2>
          <Link to="/">Back to login</Link>
        </div>
      </div>
    );
  }

  const appointmentOccurrences = expandAppointmentOccurrences(appointments, 3);

  return (
    <div className="page">
      <Link to="/portal">← Back to portal</Link>

      <div className="card">
        <h1>Full Appointment Schedule</h1>
        <p className="muted">Upcoming and recurring appointment records.</p>

        {loading ? (
          <p>Loading appointments...</p>
        ) : appointmentOccurrences.length === 0 ? (
          <p className="muted">No appointments found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Date & Time</th>
                <th>Repeat</th>
                <th>End Date</th>
              </tr>
            </thead>
            <tbody>
              {appointmentOccurrences.map((appointment, index) => (
                <tr key={`${appointment.id}-${index}`}>
                  <td>{appointment.provider}</td>
                  <td>{formatDateTime(appointment.occurrenceDate)}</td>
                  <td>{appointment.repeat}</td>
                  <td>
                    {appointment.endDate
                      ? formatDate(appointment.endDate)
                      : "No end date"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PrescriptionsPage() {
  const patientId = getStoredPatientId();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrescriptions() {
      if (!patientId) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/api/users/${patientId}/prescriptions`);
        setPrescriptions(response.data);
      } catch (error) {
        console.error("Failed to fetch prescriptions", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPrescriptions();
  }, [patientId]);

  if (!patientId) {
    return (
      <div className="page">
        <div className="card">
          <h2>Please login first</h2>
          <Link to="/">Back to login</Link>
        </div>
      </div>
    );
  }

  const refillOccurrences = expandRefillOccurrences(prescriptions, 3);

  return (
    <div className="page">
      <Link to="/portal">← Back to portal</Link>

      <div className="card">
        <h1>All Prescriptions</h1>
        <p className="muted">
          Medication and refill information for the next 3 months.
        </p>

        {loading ? (
          <p>Loading prescriptions...</p>
        ) : refillOccurrences.length === 0 ? (
          <p className="muted">No prescriptions found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Medication</th>
                <th>Dosage</th>
                <th>Quantity</th>
                <th>Refill Date</th>
                <th>Schedule</th>
              </tr>
            </thead>

            <tbody>
              {refillOccurrences.map((prescription, index) => (
                <tr key={`${prescription.id}-${index}`}>
                  <td>{prescription.medication}</td>
                  <td>{prescription.dosage}</td>
                  <td>{prescription.quantity}</td>
                  <td>{formatDate(prescription.occurrenceDate)}</td>
                  <td>{prescription.refillSchedule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminHome() {
  const [patients, setPatients] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function fetchPatients() {
    try {
      setLoading(true);
      const response = await api.get("/api/users");
      setPatients(response.data);
    } catch (err) {
      console.error("Failed to fetch patients", err);
      setError("Failed to load patients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPatients();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleCreatePatient(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await api.post("/api/users", formData);

      setFormData({
        name: "",
        email: "",
        password: "",
      });

      setMessage("Patient created successfully.");
      fetchPatients();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create patient.");
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Mini EMR Admin</h1>
          <p className="muted">Manage patients, appointments, and prescriptions.</p>
        </div>

        <Link to="/">Patient Portal</Link>
      </header>

      <section className="card">
        <h2>Create New Patient</h2>

        <form onSubmit={handleCreatePatient} className="form three-column-form">
          <label>
            Name
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Patient name"
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="patient@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Temporary password"
              required
            />
          </label>

          <button type="submit">Create Patient</button>
        </form>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Patients</h2>

        {loading ? (
          <p>Loading patients...</p>
        ) : patients.length === 0 ? (
          <p className="muted">No patients found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Email</th>
                <th>Appointments</th>
                <th>Prescriptions</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td>{patient.name}</td>
                  <td>{patient.email}</td>
                  <td>{patient.appointments?.length || 0}</td>
                  <td>{patient.prescriptions?.length || 0}</td>
                  <td>
                    <Link to={`/admin/patients/${patient.id}`}>View record</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function AdminPatientPage() {
  const { id } = useParams();

  const [patient, setPatient] = useState(null);
  const [options, setOptions] = useState({
    medications: [],
    dosages: [],
  });

  const [patientForm, setPatientForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [appointmentForm, setAppointmentForm] = useState({
    id: null,
    provider: "",
    datetime: "",
    repeat: "weekly",
    endDate: "",
  });

  const [prescriptionForm, setPrescriptionForm] = useState({
    id: null,
    medication: "",
    dosage: "",
    quantity: 1,
    refillOn: "",
    refillSchedule: "monthly",
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function fetchPatient() {
    try {
      setLoading(true);
      const response = await api.get(`/api/users/${id}`);

      setPatient(response.data);
      setPatientForm({
        name: response.data.name,
        email: response.data.email,
        password: response.data.password,
      });
    } catch (err) {
      console.error("Failed to fetch patient", err);
      setError("Failed to load patient record.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchOptions() {
    try {
      const response = await api.get("/api/options");

      setOptions(response.data);
    } catch (err) {
      console.error("Failed to fetch options", err);
    }
  }

  useEffect(() => {
    fetchPatient();
    fetchOptions();
  }, [id]);

  function handlePatientChange(event) {
    const { name, value } = event.target;

    setPatientForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAppointmentChange(event) {
    const { name, value } = event.target;

    setAppointmentForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handlePrescriptionChange(event) {
    const { name, value } = event.target;

    setPrescriptionForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleUpdatePatient(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await api.put(`/api/users/${id}`, patientForm);

      setMessage("Patient information updated successfully.");
      fetchPatient();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update patient.");
    }
  }

  async function handleSaveAppointment(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload = {
      provider: appointmentForm.provider,
      datetime: appointmentForm.datetime,
      repeat: appointmentForm.repeat,
      endDate: appointmentForm.endDate || null,
    };

    try {
      if (appointmentForm.id) {
        await api.put(`/api/appointments/${appointmentForm.id}`, payload);
        setMessage("Appointment updated successfully.");
      } else {
        await api.post(`/api/users/${id}/appointments`, payload);
        setMessage("Appointment created successfully.");
      }

      setAppointmentForm({
        id: null,
        provider: "",
        datetime: "",
        repeat: "weekly",
        endDate: "",
      });

      fetchPatient();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save appointment.");
    }
  }

  function handleEditAppointment(appointment) {
    setAppointmentForm({
      id: appointment.id,
      provider: appointment.provider,
      datetime: formatForDateTimeInput(appointment.datetime),
      repeat: appointment.repeat,
      endDate: formatForDateInput(appointment.endDate),
    });
  }

  async function handleDeleteAppointment(appointmentId) {
    setMessage("");
    setError("");

    try {
      await api.delete(`/api/appointments/${appointmentId}`);
      setMessage("Appointment deleted successfully.");
      fetchPatient();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete appointment.");
    }
  }

  async function handleSavePrescription(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload = {
      medication: prescriptionForm.medication,
      dosage: prescriptionForm.dosage,
      quantity: Number(prescriptionForm.quantity),
      refillOn: prescriptionForm.refillOn,
      refillSchedule: prescriptionForm.refillSchedule,
    };

    try {
      if (prescriptionForm.id) {
        await api.put(`/api/prescriptions/${prescriptionForm.id}`, payload);
        setMessage("Prescription updated successfully.");
      } else {
        await api.post(`/api/users/${id}/prescriptions`, payload);
        setMessage("Prescription created successfully.");
      }

      setPrescriptionForm({
        id: null,
        medication: "",
        dosage: "",
        quantity: 1,
        refillOn: "",
        refillSchedule: "monthly",
      });

      fetchPatient();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save prescription.");
    }
  }

  function handleEditPrescription(prescription) {
    setPrescriptionForm({
      id: prescription.id,
      medication: prescription.medication,
      dosage: prescription.dosage,
      quantity: prescription.quantity,
      refillOn: formatForDateInput(prescription.refillOn),
      refillSchedule: prescription.refillSchedule,
    });
  }

  async function handleDeletePrescription(prescriptionId) {
    setMessage("");
    setError("");

    try {
      await api.delete(`/api/prescriptions/${prescriptionId}`);
      setMessage("Prescription deleted successfully.");
      fetchPatient();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete prescription.");
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading patient record...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page">
        <Link to="/admin">← Back to Admin</Link>
        <div className="card">
          <h1>Patient not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/admin">← Back to Admin</Link>

      <header className="topbar">
        <div>
          <h1>{patient.name}</h1>
          <p className="muted">{patient.email}</p>
        </div>
      </header>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Edit Patient Info</h2>

        <form onSubmit={handleUpdatePatient} className="form three-column-form">
          <label>
            Name
            <input
              name="name"
              value={patientForm.name}
              onChange={handlePatientChange}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              name="email"
              value={patientForm.email}
              onChange={handlePatientChange}
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              value={patientForm.password}
              onChange={handlePatientChange}
              required
            />
          </label>

          <button type="submit">Update Patient</button>
        </form>
      </section>

      <section className="card">
        <h2>{appointmentForm.id ? "Edit Appointment" : "Add Appointment"}</h2>

        <form onSubmit={handleSaveAppointment} className="form four-column-form">
          <label>
            Provider
            <input
              name="provider"
              value={appointmentForm.provider}
              onChange={handleAppointmentChange}
              placeholder="Dr Provider Name"
              required
            />
          </label>

          <label>
            Date & Time
            <input
              type="datetime-local"
              name="datetime"
              value={appointmentForm.datetime}
              onChange={handleAppointmentChange}
              required
            />
          </label>

          <label>
            Repeat
            <select
              name="repeat"
              value={appointmentForm.repeat}
              onChange={handleAppointmentChange}
              required
            >
              <option value="none">None</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label>
            End Date
            <input
              type="date"
              name="endDate"
              value={appointmentForm.endDate}
              onChange={handleAppointmentChange}
            />
          </label>

          <button type="submit">
            {appointmentForm.id ? "Update Appointment" : "Create Appointment"}
          </button>
        </form>

        <h3>Appointments</h3>

        {patient.appointments.length === 0 ? (
          <p className="muted">No appointments found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Date & Time</th>
                <th>Repeat</th>
                <th>End Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {patient.appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td>{appointment.provider}</td>
                  <td>{formatDateTime(appointment.datetime)}</td>
                  <td>{appointment.repeat}</td>
                  <td>
                    {appointment.endDate
                      ? formatDate(appointment.endDate)
                      : "No end date"}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleEditAppointment(appointment)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleDeleteAppointment(appointment.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>
          {prescriptionForm.id ? "Edit Prescription" : "Add Prescription"}
        </h2>

        <form
          onSubmit={handleSavePrescription}
          className="form five-column-form"
        >
          <label>
            Medication
            <select
              name="medication"
              value={prescriptionForm.medication}
              onChange={handlePrescriptionChange}
              required
            >
              <option value="">Select medication</option>
              {options.medications.map((medication) => (
                <option key={medication.id} value={medication.name}>
                  {medication.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Dosage
            <select
              name="dosage"
              value={prescriptionForm.dosage}
              onChange={handlePrescriptionChange}
              required
            >
              <option value="">Select dosage</option>
              {options.dosages.map((dosage) => (
                <option key={dosage.id} value={dosage.value}>
                  {dosage.value}
                </option>
              ))}
            </select>
          </label>

          <label>
            Quantity
            <input
              type="number"
              min="1"
              name="quantity"
              value={prescriptionForm.quantity}
              onChange={handlePrescriptionChange}
              required
            />
          </label>

          <label>
            Refill Date
            <input
              type="date"
              name="refillOn"
              value={prescriptionForm.refillOn}
              onChange={handlePrescriptionChange}
              required
            />
          </label>

          <label>
            Schedule
            <select
              name="refillSchedule"
              value={prescriptionForm.refillSchedule}
              onChange={handlePrescriptionChange}
              required
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <button type="submit">
            {prescriptionForm.id
              ? "Update Prescription"
              : "Create Prescription"}
          </button>
        </form>

        <h3>Prescriptions</h3>

        {patient.prescriptions.length === 0 ? (
          <p className="muted">No prescriptions found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Medication</th>
                <th>Dosage</th>
                <th>Quantity</th>
                <th>Refill Date</th>
                <th>Schedule</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {patient.prescriptions.map((prescription) => (
                <tr key={prescription.id}>
                  <td>{prescription.medication}</td>
                  <td>{prescription.dosage}</td>
                  <td>{prescription.quantity}</td>
                  <td>{formatDate(prescription.refillOn)}</td>
                  <td>{prescription.refillSchedule}</td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleEditPrescription(prescription)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleDeletePrescription(prescription.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/portal" element={<PortalHome />} />
      <Route path="/appointments" element={<AppointmentSchedulePage />} />
      <Route path="/prescriptions" element={<PrescriptionsPage />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/patients/:id" element={<AdminPatientPage />} />
    </Routes>
  );
}

export default App;