export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_transfers: {
        Row: {
          amount: number
          created_at: string
          from_agent_id: string
          id: string
          recipient_phone: string
          status: string
          to_agent_id: string
          transferred_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_agent_id: string
          id?: string
          recipient_phone: string
          status?: string
          to_agent_id: string
          transferred_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_agent_id?: string
          id?: string
          recipient_phone?: string
          status?: string
          to_agent_id?: string
          transferred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_transfers_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_transfers_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          active_tenants: number | null
          collection_rate: number | null
          created_at: string
          id: string
          is_suspended: boolean | null
          monthly_earnings: number | null
          motorcycle_applied: boolean | null
          motorcycle_eligible: boolean | null
          portfolio_limit: number | null
          portfolio_value: number | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          total_tenants: number | null
          updated_at: string
          user_id: string
          wallet_balance: number | null
        }
        Insert: {
          active_tenants?: number | null
          collection_rate?: number | null
          created_at?: string
          id?: string
          is_suspended?: boolean | null
          monthly_earnings?: number | null
          motorcycle_applied?: boolean | null
          motorcycle_eligible?: boolean | null
          portfolio_limit?: number | null
          portfolio_value?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          total_tenants?: number | null
          updated_at?: string
          user_id: string
          wallet_balance?: number | null
        }
        Update: {
          active_tenants?: number | null
          collection_rate?: number | null
          created_at?: string
          id?: string
          is_suspended?: boolean | null
          monthly_earnings?: number | null
          motorcycle_applied?: boolean | null
          motorcycle_eligible?: boolean | null
          portfolio_limit?: number | null
          portfolio_value?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          total_tenants?: number | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_agent"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversation"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          agent_id: string
          amount: number
          collection_date: string
          commission: number
          created_at: string
          created_by: string | null
          created_by_manager: boolean | null
          id: string
          payment_id: string
          payment_method: string | null
          rejection_reason: string | null
          status: string | null
          tenant_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          agent_id: string
          amount: number
          collection_date?: string
          commission: number
          created_at?: string
          created_by?: string | null
          created_by_manager?: boolean | null
          id?: string
          payment_id: string
          payment_method?: string | null
          rejection_reason?: string | null
          status?: string | null
          tenant_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          agent_id?: string
          amount?: number
          collection_date?: string
          commission?: number
          created_at?: string
          created_by?: string | null
          created_by_manager?: boolean | null
          id?: string
          payment_id?: string
          payment_method?: string | null
          rejection_reason?: string | null
          status?: string | null
          tenant_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_message_templates: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_shared: boolean | null
          manager_id: string
          message: string
          name: string
          priority: string | null
          shared_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          manager_id: string
          message: string
          name: string
          priority?: string | null
          shared_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_shared?: boolean | null
          manager_id?: string
          message?: string
          name?: string
          priority?: string | null
          shared_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_message_templates_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      landlords: {
        Row: {
          created_at: string
          google_maps_link: string | null
          id: string
          is_verified: boolean | null
          landlord_id_url: string | null
          landlord_name: string
          landlord_phone: string
          lc1_chairperson_name: string | null
          lc1_chairperson_phone: string | null
          properties: string | null
          registered_by: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          village_cell_location: string | null
        }
        Insert: {
          created_at?: string
          google_maps_link?: string | null
          id?: string
          is_verified?: boolean | null
          landlord_id_url?: string | null
          landlord_name: string
          landlord_phone: string
          lc1_chairperson_name?: string | null
          lc1_chairperson_phone?: string | null
          properties?: string | null
          registered_by: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          village_cell_location?: string | null
        }
        Update: {
          created_at?: string
          google_maps_link?: string | null
          id?: string
          is_verified?: boolean | null
          landlord_id_url?: string | null
          landlord_name?: string
          landlord_phone?: string
          lc1_chairperson_name?: string | null
          lc1_chairperson_phone?: string | null
          properties?: string | null
          registered_by?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          village_cell_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landlords_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landlords_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_drafts: {
        Row: {
          created_at: string
          draft_name: string
          id: string
          manager_id: string
          message: string
          priority: string
          selected_agent_ids: string[] | null
          send_to_all: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_name: string
          id?: string
          manager_id: string
          message?: string
          priority?: string
          selected_agent_ids?: string[] | null
          send_to_all?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_name?: string
          id?: string
          manager_id?: string
          message?: string
          priority?: string
          selected_agent_ids?: string[] | null
          send_to_all?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_drafts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          parent_notification_id: string | null
          payment_data: Json | null
          priority: string | null
          read: boolean | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          parent_notification_id?: string | null
          payment_data?: Json | null
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          parent_notification_id?: string | null
          payment_data?: Json | null
          priority?: string | null
          read?: boolean | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_parent_notification_id_fkey"
            columns: ["parent_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      password_change_requests: {
        Row: {
          agent_id: string
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string
          rejection_reason: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: string
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_change_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_change_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          browser: string | null
          created_at: string | null
          device_type: string
          error_message: string | null
          error_type: string | null
          id: string
          load_time_ms: number | null
          memory_usage_mb: number | null
          network_latency_ms: number | null
          os: string | null
          page_route: string
          screen_resolution: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_type: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          load_time_ms?: number | null
          memory_usage_mb?: number | null
          network_latency_ms?: number | null
          os?: string | null
          page_route: string
          screen_resolution?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_type?: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          load_time_ms?: number | null
          memory_usage_mb?: number | null
          network_latency_ms?: number | null
          os?: string | null
          page_route?: string
          screen_resolution?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone_number: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone_number: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone_number?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      service_centre_managers: {
        Row: {
          agents_count: number | null
          area: string | null
          created_at: string
          id: string
          pending_verifications: number | null
          total_tenants: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agents_count?: number | null
          area?: string | null
          created_at?: string
          id?: string
          pending_verifications?: number | null
          total_tenants?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agents_count?: number | null
          area?: string | null
          created_at?: string
          id?: string
          pending_verifications?: number | null
          total_tenants?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_centre_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          agent_id: string
          archived_at: string | null
          archived_by: string | null
          created_at: string
          daily_payment_amount: number | null
          days_remaining: number | null
          due_date: string | null
          id: string
          is_archived: boolean | null
          landlord_id: string | null
          landlord_id_url: string | null
          landlord_name: string | null
          landlord_phone: string | null
          last_payment_date: string | null
          lc1_letter_url: string | null
          lc1_name: string | null
          lc1_phone: string | null
          next_payment_date: string | null
          outstanding_balance: number | null
          registration_fee: number | null
          rent_amount: number | null
          start_date: string | null
          status: string | null
          tenant_name: string
          tenant_phone: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          agent_id: string
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          daily_payment_amount?: number | null
          days_remaining?: number | null
          due_date?: string | null
          id?: string
          is_archived?: boolean | null
          landlord_id?: string | null
          landlord_id_url?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          last_payment_date?: string | null
          lc1_letter_url?: string | null
          lc1_name?: string | null
          lc1_phone?: string | null
          next_payment_date?: string | null
          outstanding_balance?: number | null
          registration_fee?: number | null
          rent_amount?: number | null
          start_date?: string | null
          status?: string | null
          tenant_name: string
          tenant_phone: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          agent_id?: string
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          daily_payment_amount?: number | null
          days_remaining?: number | null
          due_date?: string | null
          id?: string
          is_archived?: boolean | null
          landlord_id?: string | null
          landlord_id_url?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          last_payment_date?: string | null
          lc1_letter_url?: string | null
          lc1_name?: string | null
          lc1_phone?: string | null
          next_payment_date?: string | null
          outstanding_balance?: number | null
          registration_fee?: number | null
          rent_amount?: number | null
          start_date?: string | null
          status?: string | null
          tenant_name?: string
          tenant_phone?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "landlords"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      version_adoptions: {
        Row: {
          adopted_at: string
          device_info: Json | null
          id: string
          user_id: string
          version: string
        }
        Insert: {
          adopted_at?: string
          device_info?: Json | null
          id?: string
          user_id: string
          version: string
        }
        Update: {
          adopted_at?: string
          device_info?: Json | null
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_adoptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      version_history: {
        Row: {
          created_at: string
          deployed_at: string
          deployed_by: string | null
          description: string | null
          id: string
          version: string
        }
        Insert: {
          created_at?: string
          deployed_at?: string
          deployed_by?: string | null
          description?: string | null
          id?: string
          version: string
        }
        Update: {
          created_at?: string
          deployed_at?: string
          deployed_by?: string | null
          description?: string | null
          id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_history_deployed_by_fkey"
            columns: ["deployed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          agent_id: string
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          rejection_reason: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_notification_thread: {
        Args: { notification_id: string }
        Returns: {
          created_at: string
          id: string
          is_reply: boolean
          message: string
          parent_notification_id: string
          priority: string
          read: boolean
          read_at: string
          recipient_id: string
          sender_id: string
          sender_name: string
          title: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent"
      user_role: "agent" | "manager" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "agent"],
      user_role: ["agent", "manager", "admin"],
    },
  },
} as const
