export interface Specialty {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialtyInput {
  name: string;
}

export interface SpecialtyResponse {
  success: boolean;
  data?: Specialty;
  error?: string;
}
