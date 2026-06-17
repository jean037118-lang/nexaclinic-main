export {}

declare global {
  interface Window {
    api: {
      createPatient: (patient: any) => Promise<any>
      getPatients: () => Promise<any>
      updatePatient: (id: number, patient: any) => Promise<any>
      deletePatient: (id: number) => Promise<any>
      backupDatabase: () => Promise<any>
    }
  }
}