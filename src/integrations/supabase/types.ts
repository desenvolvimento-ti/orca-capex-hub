export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          directorate_id: string | null;
          email: string;
          full_name: string;
          id: string;
          phone: string | null;
          requested_area_id: string | null;
          requested_area_name: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          directorate_id?: string | null;
          email: string;
          full_name: string;
          id?: string;
          phone?: string | null;
          requested_area_id?: string | null;
          requested_area_name?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          directorate_id?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          requested_area_id?: string | null;
          requested_area_name?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "access_requests_directorate_id_fkey";
            columns: ["directorate_id"];
            isOneToOne: false;
            referencedRelation: "directorates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "access_requests_requested_area_id_fkey";
            columns: ["requested_area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
        ];
      };
      actual_entries: {
        Row: {
          amount: number;
          cc_mismatch: boolean;
          competencia: string;
          cost_center: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          doc_number: string | null;
          id: string;
          import_id: string | null;
          phase: Database["public"]["Enums"]["phase_type"] | null;
          project_code: string;
          project_id: string | null;
          source: string;
          supplier: string | null;
        };
        Insert: {
          amount: number;
          cc_mismatch?: boolean;
          competencia: string;
          cost_center?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          doc_number?: string | null;
          id?: string;
          import_id?: string | null;
          phase?: Database["public"]["Enums"]["phase_type"] | null;
          project_code: string;
          project_id?: string | null;
          source?: string;
          supplier?: string | null;
        };
        Update: {
          amount?: number;
          cc_mismatch?: boolean;
          competencia?: string;
          cost_center?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          doc_number?: string | null;
          id?: string;
          import_id?: string | null;
          phase?: Database["public"]["Enums"]["phase_type"] | null;
          project_code?: string;
          project_id?: string | null;
          source?: string;
          supplier?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "actual_entries_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "actuals_imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "actual_entries_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      actuals_imports: {
        Row: {
          competencia: string;
          created_at: string;
          file_name: string;
          id: string;
          imported_by: string | null;
          matched_rows: number;
          total_amount: number;
          total_rows: number;
          unmatched_rows: number;
        };
        Insert: {
          competencia: string;
          created_at?: string;
          file_name: string;
          id?: string;
          imported_by?: string | null;
          matched_rows?: number;
          total_amount?: number;
          total_rows?: number;
          unmatched_rows?: number;
        };
        Update: {
          competencia?: string;
          created_at?: string;
          file_name?: string;
          id?: string;
          imported_by?: string | null;
          matched_rows?: number;
          total_amount?: number;
          total_rows?: number;
          unmatched_rows?: number;
        };
        Relationships: [];
      };
      allowed_emails: {
        Row: {
          area_id: string | null;
          created_at: string;
          created_by: string | null;
          directorate_id: string | null;
          email: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          area_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          directorate_id?: string | null;
          email: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          area_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          directorate_id?: string | null;
          email?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [
          {
            foreignKeyName: "allowed_emails_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allowed_emails_directorate_id_fkey";
            columns: ["directorate_id"];
            isOneToOne: false;
            referencedRelation: "directorates";
            referencedColumns: ["id"];
          },
        ];
      };
      area_budgets: {
        Row: {
          area_id: string;
          budget_amount: number;
          created_at: string;
          cycle_id: string;
          id: string;
          notes: string | null;
          updated_at: string;
          warning_threshold: number;
        };
        Insert: {
          area_id: string;
          budget_amount?: number;
          created_at?: string;
          cycle_id: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
          warning_threshold?: number;
        };
        Update: {
          area_id?: string;
          budget_amount?: number;
          created_at?: string;
          cycle_id?: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
          warning_threshold?: number;
        };
        Relationships: [
          {
            foreignKeyName: "area_budgets_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "area_budgets_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "cycles";
            referencedColumns: ["id"];
          },
        ];
      };
      areas: {
        Row: {
          can_execute_for_others: boolean;
          created_at: string;
          created_by: string | null;
          director_id: string | null;
          id: string;
          name: string;
          status: string;
        };
        Insert: {
          can_execute_for_others?: boolean;
          created_at?: string;
          created_by?: string | null;
          director_id?: string | null;
          id?: string;
          name: string;
          status?: string;
        };
        Update: {
          can_execute_for_others?: boolean;
          created_at?: string;
          created_by?: string | null;
          director_id?: string | null;
          id?: string;
          name?: string;
          status?: string;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          code: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_units: {
        Row: {
          branch_id: string;
          code: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          code?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_units_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      cycles: {
        Row: {
          analysis_end: string | null;
          analysis_start: string | null;
          archived_at: string | null;
          created_at: string;
          cycle_end_date: string | null;
          cycle_number_in_year: number | null;
          cycle_start_date: string | null;
          id: string;
          is_active: boolean;
          name: string;
          submission_end: string | null;
          submission_start: string | null;
          year: number;
        };
        Insert: {
          analysis_end?: string | null;
          analysis_start?: string | null;
          archived_at?: string | null;
          created_at?: string;
          cycle_end_date?: string | null;
          cycle_number_in_year?: number | null;
          cycle_start_date?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          submission_end?: string | null;
          submission_start?: string | null;
          year: number;
        };
        Update: {
          analysis_end?: string | null;
          analysis_start?: string | null;
          archived_at?: string | null;
          created_at?: string;
          cycle_end_date?: string | null;
          cycle_number_in_year?: number | null;
          cycle_start_date?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          submission_end?: string | null;
          submission_start?: string | null;
          year?: number;
        };
        Relationships: [];
      };
      deviation_settings: {
        Row: {
          id: number;
          min_amount: number;
          pct: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: number;
          min_amount?: number;
          pct?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: number;
          min_amount?: number;
          pct?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      directorates: {
        Row: {
          created_at: string;
          director_name: string;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          director_name: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          director_name?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      disbursements: {
        Row: {
          amount: number;
          id: string;
          period: string;
          phase: Database["public"]["Enums"]["phase_type"];
          project_id: string;
          realized_amount: number | null;
          version: string;
        };
        Insert: {
          amount?: number;
          id?: string;
          period: string;
          phase: Database["public"]["Enums"]["phase_type"];
          project_id: string;
          realized_amount?: number | null;
          version?: string;
        };
        Update: {
          amount?: number;
          id?: string;
          period?: string;
          phase?: Database["public"]["Enums"]["phase_type"];
          project_id?: string;
          realized_amount?: number | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disbursements_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_ceiling_history: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          reason: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          reason?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          change_request_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          project_id: string | null;
          read_at: string | null;
          title: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          change_request_id?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          project_id?: string | null;
          read_at?: string | null;
          title: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          body?: string | null;
          change_request_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          project_id?: string | null;
          read_at?: string | null;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_change_request_id_fkey";
            columns: ["change_request_id"];
            isOneToOne: false;
            referencedRelation: "project_change_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          area_id: string | null;
          avatar_url: string | null;
          created_at: string;
          directorate_id: string | null;
          email: string;
          full_name: string;
          id: string;
          phone: string | null;
        };
        Insert: {
          area_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          directorate_id?: string | null;
          email: string;
          full_name: string;
          id: string;
          phone?: string | null;
        };
        Update: {
          area_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          directorate_id?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_directorate_id_fkey";
            columns: ["directorate_id"];
            isOneToOne: false;
            referencedRelation: "directorates";
            referencedColumns: ["id"];
          },
        ];
      };
      project_baselines: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          project_id: string;
          snapshot: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          project_id: string;
          snapshot: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          project_id?: string;
          snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "project_baselines_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_change_request_history: {
        Row: {
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          comment: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["change_request_status"] | null;
          id: string;
          request_id: string;
          to_status: Database["public"]["Enums"]["change_request_status"];
        };
        Insert: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          comment?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["change_request_status"] | null;
          id?: string;
          request_id: string;
          to_status: Database["public"]["Enums"]["change_request_status"];
        };
        Update: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          comment?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["change_request_status"] | null;
          id?: string;
          request_id?: string;
          to_status?: Database["public"]["Enums"]["change_request_status"];
        };
        Relationships: [];
      };
      project_change_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          id: string;
          justification: string;
          last_decision_comment: string | null;
          project_id: string;
          requested_by: string;
          requested_execution_end: string | null;
          requested_execution_start: string | null;
          requested_planning_end: string | null;
          requested_total: number | null;
          status: Database["public"]["Enums"]["change_request_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          justification: string;
          last_decision_comment?: string | null;
          project_id: string;
          requested_by: string;
          requested_execution_end?: string | null;
          requested_execution_start?: string | null;
          requested_planning_end?: string | null;
          requested_total?: number | null;
          status?: Database["public"]["Enums"]["change_request_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          justification?: string;
          last_decision_comment?: string | null;
          project_id?: string;
          requested_by?: string;
          requested_execution_end?: string | null;
          requested_execution_start?: string | null;
          requested_planning_end?: string | null;
          requested_total?: number | null;
          status?: Database["public"]["Enums"]["change_request_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      project_comments: {
        Row: {
          author_id: string;
          author_role: Database["public"]["Enums"]["app_role"] | null;
          body: string;
          created_at: string;
          id: string;
          project_id: string;
        };
        Insert: {
          author_id: string;
          author_role?: Database["public"]["Enums"]["app_role"] | null;
          body: string;
          created_at?: string;
          id?: string;
          project_id: string;
        };
        Update: {
          author_id?: string;
          author_role?: Database["public"]["Enums"]["app_role"] | null;
          body?: string;
          created_at?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_deviations: {
        Row: {
          actual: number;
          competencia: string;
          created_at: string;
          id: string;
          planned: number;
          project_id: string;
          responded_at: string | null;
          responded_by: string | null;
          response: string | null;
          response_kind: string | null;
          status: string;
          treated_at: string | null;
          treated_by: string | null;
        };
        Insert: {
          actual?: number;
          competencia: string;
          created_at?: string;
          id?: string;
          planned?: number;
          project_id: string;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: string | null;
          response_kind?: string | null;
          status?: string;
          treated_at?: string | null;
          treated_by?: string | null;
        };
        Update: {
          actual?: number;
          competencia?: string;
          created_at?: string;
          id?: string;
          planned?: number;
          project_id?: string;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: string | null;
          response_kind?: string | null;
          status?: string;
          treated_at?: string | null;
          treated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_deviations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_documents: {
        Row: {
          doc_type_id: string | null;
          file_name: string;
          file_path: string;
          id: string;
          project_id: string;
          uploaded_at: string;
          uploaded_by: string;
        };
        Insert: {
          doc_type_id?: string | null;
          file_name: string;
          file_path: string;
          id?: string;
          project_id: string;
          uploaded_at?: string;
          uploaded_by: string;
        };
        Update: {
          doc_type_id?: string | null;
          file_name?: string;
          file_path?: string;
          id?: string;
          project_id?: string;
          uploaded_at?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_documents_doc_type_id_fkey";
            columns: ["doc_type_id"];
            isOneToOne: false;
            referencedRelation: "required_document_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_status_history: {
        Row: {
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          comment: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["project_status"] | null;
          id: string;
          project_id: string;
          to_status: Database["public"]["Enums"]["project_status"];
        };
        Insert: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          comment?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["project_status"] | null;
          id?: string;
          project_id: string;
          to_status: Database["public"]["Enums"]["project_status"];
        };
        Update: {
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          comment?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["project_status"] | null;
          id?: string;
          project_id?: string;
          to_status?: Database["public"]["Enums"]["project_status"];
        };
        Relationships: [
          {
            foreignKeyName: "project_status_history_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        Insert: {
          accounting_code?: string | null;
          already_in_execution?: boolean;
          area_id: string;
          baseline_frozen_at?: string | null;
          branch_id?: string | null;
          business_unit_id?: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount?: number | null;
          ceo_decision_justification?: string | null;
          code?: string | null;
          concluido_em?: string | null;
          confirmed_total?: number | null;
          cost_center?: string | null;
          created_at?: string;
          created_by_fpa?: boolean;
          cycle_id?: string | null;
          decided_at?: string | null;
          description?: string;
          directoria_suggested_amount?: number | null;
          est_end_date?: string | null;
          est_start_date?: string | null;
          estimated_total?: number;
          execution_amount?: number | null;
          execution_end_date?: string | null;
          execution_months?: number | null;
          execution_start_date?: string | null;
          executor_area_id?: string | null;
          extraordinary_approval?: boolean;
          firm_execution_amount?: number | null;
          firm_execution_months?: number | null;
          firm_execution_start_date?: string | null;
          firm_study_amount?: number | null;
          firm_study_start_date?: string | null;
          flag_acompanhamento?: boolean;
          flag_next_cycle?: boolean;
          fpa_approved_amount?: number | null;
          fpa_risk?: Database["public"]["Enums"]["risk_level"] | null;
          id?: string;
          indicativo_zero_months?: string[];
          justification?: string;
          last_deferral_reason?: string | null;
          name: string;
          owner_id: string;
          parent_project_id?: string | null;
          payback_months?: number | null;
          payback_na_justification?: string | null;
          payback_not_applicable?: boolean;
          planning_end_date?: string | null;
          previously_deferred_count?: number;
          prioritization_justification?: string | null;
          prioritization_published_at?: string | null;
          prioritization_result?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          release_justification?: string | null;
          released_amount?: number | null;
          status?: Database["public"]["Enums"]["project_status"];
          study_amount?: number | null;
          study_start_date?: string | null;
          submitted_at?: string | null;
          tir_pct?: number | null;
          total_execution?: number | null;
          total_planning?: number | null;
          updated_at?: string;
          validation_justification?: string | null;
          viability_summary?: string | null;
        };
        Update: {
          accounting_code?: string | null;
          already_in_execution?: boolean;
          area_id?: string;
          baseline_frozen_at?: string | null;
          branch_id?: string | null;
          business_unit_id?: string | null;
          category?: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount?: number | null;
          ceo_decision_justification?: string | null;
          code?: string | null;
          concluido_em?: string | null;
          confirmed_total?: number | null;
          cost_center?: string | null;
          created_at?: string;
          created_by_fpa?: boolean;
          cycle_id?: string | null;
          decided_at?: string | null;
          description?: string;
          directoria_suggested_amount?: number | null;
          est_end_date?: string | null;
          est_start_date?: string | null;
          estimated_total?: number;
          execution_amount?: number | null;
          execution_end_date?: string | null;
          execution_months?: number | null;
          execution_start_date?: string | null;
          executor_area_id?: string | null;
          extraordinary_approval?: boolean;
          firm_execution_amount?: number | null;
          firm_execution_months?: number | null;
          firm_execution_start_date?: string | null;
          firm_study_amount?: number | null;
          firm_study_start_date?: string | null;
          flag_acompanhamento?: boolean;
          flag_next_cycle?: boolean;
          fpa_approved_amount?: number | null;
          fpa_risk?: Database["public"]["Enums"]["risk_level"] | null;
          id?: string;
          indicativo_zero_months?: string[];
          justification?: string;
          last_deferral_reason?: string | null;
          name?: string;
          owner_id?: string;
          parent_project_id?: string | null;
          payback_months?: number | null;
          payback_na_justification?: string | null;
          payback_not_applicable?: boolean;
          planning_end_date?: string | null;
          previously_deferred_count?: number;
          prioritization_justification?: string | null;
          prioritization_published_at?: string | null;
          prioritization_result?: string | null;
          priority?: Database["public"]["Enums"]["priority_level"];
          release_justification?: string | null;
          released_amount?: number | null;
          status?: Database["public"]["Enums"]["project_status"];
          study_amount?: number | null;
          study_start_date?: string | null;
          submitted_at?: string | null;
          tir_pct?: number | null;
          total_execution?: number | null;
          total_planning?: number | null;
          updated_at?: string;
          validation_justification?: string | null;
          viability_summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_business_unit_id_fkey";
            columns: ["business_unit_id"];
            isOneToOne: false;
            referencedRelation: "business_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_executor_area_id_fkey";
            columns: ["executor_area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_parent_project_id_fkey";
            columns: ["parent_project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      required_document_types: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          id: string;
          is_required: boolean;
          key: string;
          label: string;
          required_for_stage: number;
          sort_order: number;
          updated_at: string;
          uploader_role: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_required?: boolean;
          key: string;
          label: string;
          required_for_stage?: number;
          sort_order?: number;
          updated_at?: string;
          uploader_role?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_required?: boolean;
          key?: string;
          label?: string;
          required_for_stage?: number;
          sort_order?: number;
          updated_at?: string;
          uploader_role?: string;
        };
        Relationships: [];
      };
      unmatched_actuals_queue: {
        Row: {
          assigned_manager_id: string | null;
          cost_center: string;
          created_at: string;
          id: string;
          project_code: string;
          resolution: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assigned_manager_id?: string | null;
          cost_center?: string;
          created_at?: string;
          id?: string;
          project_code: string;
          resolution?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assigned_manager_id?: string | null;
          cost_center?: string;
          created_at?: string;
          id?: string;
          project_code?: string;
          resolution?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      windows: {
        Row: {
          area_id: string | null;
          auto_transition: boolean;
          closes_at: string | null;
          created_at: string;
          cycle_id: string;
          id: string;
          is_open: boolean;
          opens_at: string | null;
          type: Database["public"]["Enums"]["window_type"];
        };
        Insert: {
          area_id?: string | null;
          auto_transition?: boolean;
          closes_at?: string | null;
          created_at?: string;
          cycle_id: string;
          id?: string;
          is_open?: boolean;
          opens_at?: string | null;
          type: Database["public"]["Enums"]["window_type"];
        };
        Update: {
          area_id?: string | null;
          auto_transition?: boolean;
          closes_at?: string | null;
          created_at?: string;
          cycle_id?: string;
          id?: string;
          is_open?: boolean;
          opens_at?: string | null;
          type?: Database["public"]["Enums"]["window_type"];
        };
        Relationships: [
          {
            foreignKeyName: "windows_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "windows_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "cycles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ajustar_previsao: {
        Args: { p_project_id: string; p_rows: Json };
        Returns: undefined;
      };
      approve_access_request: {
        Args: {
          p_area_id?: string;
          p_request_id: string;
          p_role: Database["public"]["Enums"]["app_role"];
        };
        Returns: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          directorate_id: string | null;
          email: string;
          full_name: string;
          id: string;
          phone: string | null;
          requested_area_id: string | null;
          requested_area_name: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "access_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      archive_cycle: { Args: { p_cycle_id: string }; Returns: undefined };
      area_budget_usage: {
        Args: { p_cycle_id: string };
        Returns: {
          approved_amount: number;
          area_id: string;
          area_name: string;
          budget_amount: number;
          planned_amount: number;
          projects_count: number;
          released_amount: number;
          warning_threshold: number;
        }[];
      };
      ceo_user_ids: { Args: never; Returns: string[] };
      concluir_projeto: {
        Args: { p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_cycle_period: { Args: { p_cycle_id: string }; Returns: string };
      current_user_area: { Args: never; Returns: string };
      cycle_funnel: {
        Args: { p_cycle_id: string };
        Returns: {
          status: string;
          total: number;
        }[];
      };
      decisao_alteracao: {
        Args: { p_acao: string; p_justificativa: string; p_request_id: string };
        Returns: {
          created_at: string;
          decided_at: string | null;
          id: string;
          justification: string;
          last_decision_comment: string | null;
          project_id: string;
          requested_by: string;
          requested_execution_end: string | null;
          requested_execution_start: string | null;
          requested_planning_end: string | null;
          requested_total: number | null;
          status: Database["public"]["Enums"]["change_request_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "project_change_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decisao_diretor: {
        Args: {
          p_aprovado: boolean;
          p_justificativa: string;
          p_project_id: string;
        };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decisao_diretoria: {
        Args: { p_acao: string; p_justificativa: string; p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decisao_diretoria_final: {
        Args: { p_acao: string; p_justificativa: string; p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decisao_diretoria_prev: {
        Args: {
          p_acao: string;
          p_justificativa: string;
          p_project_id: string;
          p_valor_sugerido: number;
        };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decisao_validacao_execucao: {
        Args: { p_acao: string; p_justificativa: string; p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      encaminhar_para_diretor: {
        Args: { p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      encaminhar_para_diretoria_final: {
        Args: { p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      encaminhar_para_diretoria_prev: {
        Args: { p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fpa_pre_analise: {
        Args: { p_acao: string; p_comentario: string; p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fpa_user_ids: { Args: never; Returns: string[] };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      import_actuals: {
        Args: { p_competencia: string; p_file_name: string; p_rows: Json };
        Returns: {
          competencia: string;
          created_at: string;
          file_name: string;
          id: string;
          imported_by: string | null;
          matched_rows: number;
          total_amount: number;
          total_rows: number;
          unmatched_rows: number;
        };
        SetofOptions: {
          from: "*";
          to: "actuals_imports";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_project_executor: { Args: { p_project_id: string }; Returns: boolean };
      missing_active_required_docs: {
        Args: { p_project_id: string; p_stage: number };
        Returns: string[];
      };
      missing_required_docs: {
        Args: { p_project_id: string; p_stage?: number };
        Returns: {
          id: string;
          key: string;
          label: string;
          required_for_stage: number;
        }[];
      };
      notify_users: {
        Args: {
          p_body: string;
          p_change_request_id: string;
          p_kind: string;
          p_project_id: string;
          p_title: string;
          p_url: string;
          p_user_ids: string[];
        };
        Returns: undefined;
      };
      project_audit_timeline: {
        Args: { p_project_id: string };
        Returns: {
          actor_id: string;
          actor_name: string;
          actor_role: string;
          comment: string;
          event_at: string;
          from_status: string;
          kind: string;
          ref_id: string;
          to_status: string;
        }[];
      };
      publicar_priorizacao: {
        Args: { p_project_ids: string[] };
        Returns: number;
      };
      recalc_deviations: { Args: { p_project_id: string }; Returns: number };
      registrar_priorizacao: {
        Args: {
          p_justificativa: string;
          p_project_id: string;
          p_resultado: string;
        };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reject_access_request: {
        Args: { p_request_id: string };
        Returns: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          directorate_id: string | null;
          email: string;
          full_name: string;
          id: string;
          phone: string | null;
          requested_area_id: string | null;
          requested_area_name: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "access_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resolver_fora_do_rito: {
        Args: {
          p_acao: string;
          p_comentario: string;
          p_manager_id: string;
          p_project_id: string;
          p_queue_id: string;
        };
        Returns: {
          assigned_manager_id: string | null;
          cost_center: string;
          created_at: string;
          id: string;
          project_code: string;
          resolution: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "unmatched_actuals_queue";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      responder_desvio: {
        Args: { p_deviation_id: string; p_kind: string; p_texto: string };
        Returns: {
          actual: number;
          competencia: string;
          created_at: string;
          id: string;
          planned: number;
          project_id: string;
          responded_at: string | null;
          responded_by: string | null;
          response: string | null;
          response_kind: string | null;
          status: string;
          treated_at: string | null;
          treated_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "project_deviations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      responder_devolucao_pre: {
        Args: {
          p_acao: string;
          p_comentario: string;
          p_novo_valor: number;
          p_project_id: string;
        };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      solicitar_alteracao: {
        Args: {
          p_justificativa: string;
          p_project_id: string;
          p_requested_execution_end?: string;
          p_requested_execution_start?: string;
          p_requested_planning_end?: string;
          p_requested_total?: number;
        };
        Returns: {
          created_at: string;
          decided_at: string | null;
          id: string;
          justification: string;
          last_decision_comment: string | null;
          project_id: string;
          requested_by: string;
          requested_execution_end: string | null;
          requested_execution_start: string | null;
          requested_planning_end: string | null;
          requested_total: number | null;
          status: Database["public"]["Enums"]["change_request_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "project_change_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      stage1_missing: { Args: { p_project_id: string }; Returns: string[] };
      stage1_missing_split: { Args: { p_project_id: string }; Returns: Json };
      stage2_missing: { Args: { p_project_id: string }; Returns: string[] };
      status_avg_days: {
        Args: { p_cycle_id: string };
        Returns: {
          avg_days: number;
          samples: number;
          status: string;
        }[];
      };
      submeter_documentacao: {
        Args: { p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submeter_projeto: {
        Args: { p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submeter_projeto_firme: {
        Args: { p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_project_to_cycle: {
        Args: { p_cycle_id: string; p_project_id: string };
        Returns: {
          accounting_code: string | null;
          already_in_execution: boolean;
          area_id: string;
          baseline_frozen_at: string | null;
          branch_id: string | null;
          business_unit_id: string | null;
          category: Database["public"]["Enums"]["project_category"];
          ceo_approved_amount: number | null;
          ceo_decision_justification: string | null;
          code: string | null;
          concluido_em: string | null;
          confirmed_total: number | null;
          cost_center: string | null;
          created_at: string;
          created_by_fpa: boolean;
          cycle_id: string | null;
          decided_at: string | null;
          description: string;
          directoria_suggested_amount: number | null;
          est_end_date: string | null;
          est_start_date: string | null;
          estimated_total: number;
          execution_amount: number | null;
          execution_end_date: string | null;
          execution_months: number | null;
          execution_start_date: string | null;
          executor_area_id: string | null;
          extraordinary_approval: boolean;
          firm_execution_amount: number | null;
          firm_execution_months: number | null;
          firm_execution_start_date: string | null;
          firm_study_amount: number | null;
          firm_study_start_date: string | null;
          flag_acompanhamento: boolean;
          flag_next_cycle: boolean;
          fpa_approved_amount: number | null;
          fpa_risk: Database["public"]["Enums"]["risk_level"] | null;
          id: string;
          indicativo_zero_months: string[];
          justification: string;
          last_deferral_reason: string | null;
          name: string;
          owner_id: string;
          parent_project_id: string | null;
          payback_months: number | null;
          payback_na_justification: string | null;
          payback_not_applicable: boolean;
          planning_end_date: string | null;
          previously_deferred_count: number;
          prioritization_justification: string | null;
          prioritization_published_at: string | null;
          prioritization_result: string | null;
          priority: Database["public"]["Enums"]["priority_level"];
          release_justification: string | null;
          released_amount: number | null;
          status: Database["public"]["Enums"]["project_status"];
          study_amount: number | null;
          study_start_date: string | null;
          submitted_at: string | null;
          tir_pct: number | null;
          total_execution: number | null;
          total_planning: number | null;
          updated_at: string;
          validation_justification: string | null;
          viability_summary: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      tratar_desvio: {
        Args: { p_acao: string; p_comentario: string; p_deviation_id: string };
        Returns: {
          actual: number;
          competencia: string;
          created_at: string;
          id: string;
          planned: number;
          project_id: string;
          responded_at: string | null;
          responded_by: string | null;
          response: string | null;
          response_kind: string | null;
          status: string;
          treated_at: string | null;
          treated_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "project_deviations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      app_role: "manager" | "fpa" | "cfo" | "ceo" | "cco" | "cmo";
      change_request_status:
        | "pendente_fpa"
        | "aguardando_diretor"
        | "aguardando_ceo"
        | "aprovado"
        | "devolvido_revisao"
        | "reprovado";
      phase_type: "planejamento" | "execucao";
      priority_level: "alta" | "media" | "baixa";
      project_category:
        | "novos_negocios"
        | "infraestrutura_crescimento"
        | "manutencao_recorrente"
        | "manutencao_ciclica_estrutural"
        | "experiencia_cliente"
        | "eficiencia_operacional"
        | "infraestrutura_colaboradores"
        | "implementacao_novos_negocios"
        | "aprimoramento_negocios_existentes"
        | "manutencao_extraordinaria"
        | "intangivel_ti"
        | "ativo_biologico";
      project_status:
        | "rascunho"
        | "submetido_intake"
        | "pre_aprovado"
        | "postergado"
        | "cancelado"
        | "aguardando_submissao"
        | "submetido_documentacao"
        | "em_revisao_fpa"
        | "devolvido_revisao"
        | "aguardando_cfo"
        | "retornado_backlog"
        | "aguardando_ceo"
        | "liberado"
        | "liberado_parcial"
        | "reprovado"
        | "no_hub"
        | "aguardando_diretor"
        | "nao_aprovado"
        | "no_ciclo"
        | "em_pre_analise_fpa"
        | "aguardando_diretoria_prev"
        | "devolvido_pre"
        | "nao_aprovado_pre"
        | "aguardando_documentacao"
        | "em_analise_fpa_orc"
        | "aguardando_diretoria_final"
        | "devolvido_orc"
        | "aprovado_final"
        | "reprovado_final"
        | "em_execucao"
        | "concluido"
        | "em_projeto_firme"
        | "em_validacao_execucao"
        | "estudo_concluido";
      risk_level: "baixo" | "medio" | "alto";
      window_type: "submissao" | "analise" | "fechado";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["manager", "fpa", "cfo", "ceo", "cco", "cmo"],
      change_request_status: [
        "pendente_fpa",
        "aguardando_diretor",
        "aguardando_ceo",
        "aprovado",
        "devolvido_revisao",
        "reprovado",
      ],
      phase_type: ["planejamento", "execucao"],
      priority_level: ["alta", "media", "baixa"],
      project_category: [
        "novos_negocios",
        "infraestrutura_crescimento",
        "manutencao_recorrente",
        "manutencao_ciclica_estrutural",
        "experiencia_cliente",
        "eficiencia_operacional",
        "infraestrutura_colaboradores",
        "implementacao_novos_negocios",
        "aprimoramento_negocios_existentes",
        "manutencao_extraordinaria",
        "intangivel_ti",
        "ativo_biologico",
      ],
      project_status: [
        "rascunho",
        "submetido_intake",
        "pre_aprovado",
        "postergado",
        "cancelado",
        "aguardando_submissao",
        "submetido_documentacao",
        "em_revisao_fpa",
        "devolvido_revisao",
        "aguardando_cfo",
        "retornado_backlog",
        "aguardando_ceo",
        "liberado",
        "liberado_parcial",
        "reprovado",
        "no_hub",
        "aguardando_diretor",
        "nao_aprovado",
        "no_ciclo",
        "em_pre_analise_fpa",
        "aguardando_diretoria_prev",
        "devolvido_pre",
        "nao_aprovado_pre",
        "aguardando_documentacao",
        "em_analise_fpa_orc",
        "aguardando_diretoria_final",
        "devolvido_orc",
        "aprovado_final",
        "reprovado_final",
        "em_execucao",
        "concluido",
        "em_projeto_firme",
        "em_validacao_execucao",
        "estudo_concluido",
      ],
      risk_level: ["baixo", "medio", "alto"],
      window_type: ["submissao", "analise", "fechado"],
    },
  },
} as const;
