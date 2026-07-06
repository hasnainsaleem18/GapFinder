// hand-written to mirror supabase/migrations/00001_init.sql, in the exact
// shape `supabase gen types typescript` spits out. keeping the regen command
// here so future-me doesn't have to look it up:
//
//   npx supabase gen types typescript --project-id <ref> --schema public > lib/database.types.ts

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
      sessions: {
        Row: {
          id: string;
          created_at: string;
          raw_idea: string;
          status: Database["public"]["Enums"]["session_status"];
        };
        Insert: {
          id?: string;
          created_at?: string;
          raw_idea: string;
          status?: Database["public"]["Enums"]["session_status"];
        };
        Update: {
          id?: string;
          created_at?: string;
          raw_idea?: string;
          status?: Database["public"]["Enums"]["session_status"];
        };
        Relationships: [];
      };
      requirement_state: {
        Row: {
          session_id: string;
          category: Database["public"]["Enums"]["requirement_category"];
          status: Database["public"]["Enums"]["requirement_status"];
          resolved_value: string | null;
        };
        Insert: {
          session_id: string;
          category: Database["public"]["Enums"]["requirement_category"];
          status?: Database["public"]["Enums"]["requirement_status"];
          resolved_value?: string | null;
        };
        Update: {
          session_id?: string;
          category?: Database["public"]["Enums"]["requirement_category"];
          status?: Database["public"]["Enums"]["requirement_status"];
          resolved_value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "requirement_state_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      qa_history: {
        Row: {
          id: number;
          session_id: string;
          round: number;
          question: string;
          answer: string | null;
        };
        Insert: {
          id?: never; // generated always as identity
          session_id: string;
          round: number;
          question: string;
          answer?: string | null;
        };
        Update: {
          id?: never;
          session_id?: string;
          round?: number;
          question?: string;
          answer?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "qa_history_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      generated_docs: {
        Row: {
          id: string;
          session_id: string;
          user_stories: Json;
          acceptance_criteria: Json;
          assumptions: Json;
          risks: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_stories?: Json;
          acceptance_criteria?: Json;
          assumptions?: Json;
          risks?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_stories?: Json;
          acceptance_criteria?: Json;
          assumptions?: Json;
          risks?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generated_docs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      session_status: "gathering" | "complete";
      requirement_status: "resolved" | "ambiguous" | "missing";
      requirement_category:
        | "auth_roles"
        | "data_model"
        | "payments"
        | "notifications"
        | "security_compliance"
        | "integrations"
        | "non_functional";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ── Helper types (same as the generator emits) ──────────────────────

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      session_status: ["gathering", "complete"],
      requirement_status: ["resolved", "ambiguous", "missing"],
      requirement_category: [
        "auth_roles",
        "data_model",
        "payments",
        "notifications",
        "security_compliance",
        "integrations",
        "non_functional",
      ],
    },
  },
} as const;
