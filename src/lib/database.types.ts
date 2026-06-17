/**
 * database.types.ts
 * Tipos TypeScript gerados manualmente para o schema do NexaClinic.
 *
 * Dica: depois de criar o projeto no Supabase, você pode gerar isso
 * automaticamente com: npx supabase gen types typescript --project-id SEU_ID
 *
 * Coloque em: src/lib/database.types.ts
 */

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "aguardando"
  | "em_atendimento"
  | "finalizado"
  | "cancelado"
  | "faltou";

export interface Database {
  public: {
    Tables: {
      pacientes: {
        Row: {
          id: string;
          name: string;
          cpf: string | null;
          birth: string | null;
          phone: string | null;
          email: string | null;
          insurance: string;
          last_visit: string | null;
          status: "ativo" | "inativo";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pacientes"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pacientes"]["Insert"]>;
      };

      profissionais: {
        Row: {
          id: string;
          name: string;
          specialty: string | null;
          crm: string | null;
          color: string;
          active: boolean;
          appointment_duration: number;
          work_days: string;
          repasse_type: "percentual" | "fixo";
          repasse_value: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profissionais"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profissionais"]["Insert"]>;
      };

      convenios: {
        Row: {
          id: string;
          name: string;
          tipo: string | null;
          ans_code: string | null;
          contact: string | null;
          phone: string | null;
          email: string | null;
          status: "ativo" | "inativo";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["convenios"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["convenios"]["Insert"]>;
      };

      procedimentos: {
        Row: {
          id: string;
          name: string;
          tuss_code: string | null;
          category: string | null;
          duration_min: number;
          valor_particular: number | null;
          convenio_valores: Array<{ convenio: string; valor: string }>;
          status: "ativo" | "inativo";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["procedimentos"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["procedimentos"]["Insert"]>;
      };

      agendamentos: {
        Row: {
          id: string;
          patient_name: string;
          patient_id: string | null;
          professional_id: string | null;
          date: string;
          start_time: string;
          duration_min: number;
          status: AppointmentStatus;
          procedure_name: string | null;
          insurance: string;
          phone: string | null;
          procedure_value: number | null;
          amount: number | null;
          payment_method: string | null;
          paid: boolean;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agendamentos"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agendamentos"]["Insert"]>;
      };

      agenda_logs: {
        Row: {
          id: string;
          appointment_id: string | null;
          action: string;
          detail: string | null;
          at: string;
          user_name: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["agenda_logs"]["Row"], "id" | "at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agenda_logs"]["Insert"]>;
      };
    };
  };
}
