export class ReportService {
  appointments: Appointment[];
  patients: Patient[];
  professionals: Professional[];

  constructor(
    appointments: Appointment[],
    patients: Patient[],
    professionals: Professional[]
  ) {
    this.appointments = appointments;
    this.patients = patients;
    this.professionals = professionals;
  }