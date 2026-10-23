// Типи схеми бази. Оновлюйте разом із міграцією: готовий файл — у Summary прогону job db-check у CI
// (supabase gen types typescript --local на одноразовій базі); або npm run db:types після npx supabase link на ваш проєкт.
// Ця версія написана вручну за міграціями 20261012000000_profiles_and_roles.sql, 20261021150000_slot_hold_roles.sql,
// 20261021150100_slot_holds.sql і 20261021160000_hold_and_confirm.sql.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      therapists: {
        Row: {
          id: string;
          email: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      slots: {
        Row: {
          id: string;
          therapist_id: string;
          starts_at: string;
          ends_at: string;
        };
        Insert: {
          id?: string;
          therapist_id: string;
          starts_at: string;
          ends_at: string;
        };
        Update: {
          id?: string;
          therapist_id?: string;
          starts_at?: string;
          ends_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "slots_therapist_id_fkey";
            columns: ["therapist_id"];
            isOneToOne: false;
            referencedRelation: "therapists";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          client_type: string;
          date_of_birth: string | null;
          session_language: string | null;
          guardian_name: string | null;
          guardian_email: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          client_type?: string;
          date_of_birth?: string | null;
          session_language?: string | null;
          guardian_name?: string | null;
          guardian_email?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          client_type?: string;
          date_of_birth?: string | null;
          session_language?: string | null;
          guardian_name?: string | null;
          guardian_email?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      holds: {
        Row: {
          id: string;
          slot_id: string;
          client_id: string;
          created_by: string | null;
          created_at: string;
          expires_at: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          released_at: string | null;
        };
        Insert: {
          id?: string;
          slot_id: string;
          client_id: string;
          created_by?: string | null;
          created_at: string;
          expires_at: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          released_at?: string | null;
        };
        Update: {
          id?: string;
          slot_id?: string;
          client_id?: string;
          created_by?: string | null;
          created_at?: string;
          expires_at?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          released_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "holds_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "holds_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      hold_slot: {
        Args: { p_slot_id: string; p_client_id: string };
        Returns: Json;
      };
      confirm_hold: {
        Args: { p_hold_id: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
