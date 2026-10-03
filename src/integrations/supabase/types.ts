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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allocation_targets: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          target_percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          id?: string
          target_percentage: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          target_percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_alert_thresholds: {
        Row: {
          created_at: string
          id: string
          investment_id: string
          threshold: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investment_id: string
          threshold: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investment_id?: string
          threshold?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_alert_thresholds_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          available_credit_limit: number | null
          balance: number
          balance_close_date: string | null
          balance_due_date: string | null
          bank_connection_id: string
          card_brand: string | null
          created_at: string
          credit_limit: number | null
          currency_code: string
          external_id: string
          id: string
          minimum_payment: number | null
          name: string
          number: string | null
          subtype: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_credit_limit?: number | null
          balance?: number
          balance_close_date?: string | null
          balance_due_date?: string | null
          bank_connection_id: string
          card_brand?: string | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string
          external_id: string
          id?: string
          minimum_payment?: number | null
          name: string
          number?: string | null
          subtype?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_credit_limit?: number | null
          balance?: number
          balance_close_date?: string | null
          balance_due_date?: string | null
          bank_connection_id?: string
          card_brand?: string | null
          created_at?: string
          credit_limit?: number | null
          currency_code?: string
          external_id?: string
          id?: string
          minimum_payment?: number | null
          name?: string
          number?: string | null
          subtype?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          auto_sync: boolean
          bank_updated_at: string | null
          consent_expires_at: string | null
          created_at: string
          id: string
          institution_name: string
          last_sync_at: string | null
          pluggy_item_id: string | null
          provider: string
          status: string
          status_detail: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync?: boolean
          bank_updated_at?: string | null
          consent_expires_at?: string | null
          created_at?: string
          id?: string
          institution_name: string
          last_sync_at?: string | null
          pluggy_item_id?: string | null
          provider?: string
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sync?: boolean
          bank_updated_at?: string | null
          consent_expires_at?: string | null
          created_at?: string
          id?: string
          institution_name?: string
          last_sync_at?: string | null
          pluggy_item_id?: string | null
          provider?: string
          status?: string
          status_detail?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bill_payments: {
        Row: {
          amount: number | null
          bill_id: string
          id: string
          paid_at: string
          period: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          bill_id: string
          id?: string
          paid_at?: string
          period: string
          user_id: string
        }
        Update: {
          amount?: number | null
          bill_id?: string
          id?: string
          paid_at?: string
          period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          active: boolean
          amount: number
          category: string | null
          created_at: string
          due_date: string | null
          due_day: number | null
          id: string
          recurrence: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          due_date?: string | null
          due_day?: number | null
          id?: string
          recurrence?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          due_date?: string | null
          due_day?: number | null
          id?: string
          recurrence?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categorization_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          keyword: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          keyword: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          keyword?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      category_budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          monthly_budget: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          monthly_budget: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          monthly_budget?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          family_id: string
          id: string
          token_hash: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          family_id: string
          id?: string
          token_hash: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          family_id?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          display_name: string
          family_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          display_name: string
          family_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          display_name?: string
          family_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          category: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          current_amount: number
          deadline: string | null
          description: string | null
          id: string
          target_amount: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_amount?: number
          deadline?: string | null
          description?: string | null
          id?: string
          target_amount: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_amount?: number
          deadline?: string | null
          description?: string | null
          id?: string
          target_amount?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_balance_history: {
        Row: {
          balance: number
          bank_connection_id: string
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          balance: number
          bank_connection_id: string
          created_at?: string
          date: string
          id?: string
          user_id: string
        }
        Update: {
          balance?: number
          bank_connection_id?: string
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_balance_history_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          asset_name: string
          asset_type: string
          created_at: string
          current_price: number
          id: string
          purchase_date: string
          purchase_price: number
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_name: string
          asset_type: string
          created_at?: string
          current_price: number
          id?: string
          purchase_date: string
          purchase_price: number
          quantity: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_name?: string
          asset_type?: string
          created_at?: string
          current_price?: number
          id?: string
          purchase_date?: string
          purchase_price?: number
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          emailed_at: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key: string
          emailed_at?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          emailed_at?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_credentials: {
        Row: {
          client_id: string
          created_at: string
          secret_ciphertext: string
          secret_iv: string
          updated_at: string
          user_id: string
          verified_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          secret_ciphertext: string
          secret_iv: string
          updated_at?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          secret_ciphertext?: string
          secret_iv?: string
          updated_at?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      price_alert_settings: {
        Row: {
          created_at: string
          global_threshold: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          global_threshold?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          global_threshold?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email_notifications: boolean
          id: string
          onboarding_completed: boolean
          ui_mode: string
          updated_at: string
          weekly_summary: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          id: string
          onboarding_completed?: boolean
          ui_mode?: string
          updated_at?: string
          weekly_summary?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          id?: string
          onboarding_completed?: boolean
          ui_mode?: string
          updated_at?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      saved_simulations: {
        Row: {
          created_at: string
          earnings: number | null
          id: string
          initial_value: number
          monthly_contribution: number | null
          name: string
          rate: number
          result: number
          target: number | null
          total_invested: number | null
          type: string
          updated_at: string
          user_id: string
          years: number
        }
        Insert: {
          created_at?: string
          earnings?: number | null
          id?: string
          initial_value?: number
          monthly_contribution?: number | null
          name: string
          rate: number
          result: number
          target?: number | null
          total_invested?: number | null
          type: string
          updated_at?: string
          user_id: string
          years: number
        }
        Update: {
          created_at?: string
          earnings?: number | null
          id?: string
          initial_value?: number
          monthly_contribution?: number | null
          name?: string
          rate?: number
          result?: number
          target?: number | null
          total_invested?: number | null
          type?: string
          updated_at?: string
          user_id?: string
          years?: number
        }
        Relationships: []
      }
      synced_investments: {
        Row: {
          amount_original: number | null
          amount_profit: number | null
          balance: number
          bank_connection_id: string
          code: string | null
          created_at: string
          currency_code: string
          due_date: string | null
          external_id: string
          id: string
          issuer: string | null
          name: string
          quantity: number | null
          rate: number | null
          rate_type: string | null
          reference_date: string | null
          status: string | null
          subtype: string | null
          synced_at: string
          type: string
          unit_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_original?: number | null
          amount_profit?: number | null
          balance?: number
          bank_connection_id: string
          code?: string | null
          created_at?: string
          currency_code?: string
          due_date?: string | null
          external_id: string
          id?: string
          issuer?: string | null
          name: string
          quantity?: number | null
          rate?: number | null
          rate_type?: string | null
          reference_date?: string | null
          status?: string | null
          subtype?: string | null
          synced_at?: string
          type: string
          unit_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_original?: number | null
          amount_profit?: number | null
          balance?: number
          bank_connection_id?: string
          code?: string | null
          created_at?: string
          currency_code?: string
          due_date?: string | null
          external_id?: string
          id?: string
          issuer?: string | null
          name?: string
          quantity?: number | null
          rate?: number | null
          rate_type?: string | null
          reference_date?: string | null
          status?: string | null
          subtype?: string | null
          synced_at?: string
          type?: string
          unit_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synced_investments_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      synced_transactions: {
        Row: {
          ai_category: string | null
          ai_confidence: number | null
          amount: number
          bank_account_id: string | null
          bank_connection_id: string
          category_source: string | null
          created_at: string
          date: string
          description: string
          external_id: string
          hash: string | null
          id: string
          installment_info: string | null
          is_reviewed: boolean
          original_category: string | null
          source: string
          synced_at: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_category?: string | null
          ai_confidence?: number | null
          amount: number
          bank_account_id?: string | null
          bank_connection_id: string
          category_source?: string | null
          created_at?: string
          date: string
          description: string
          external_id: string
          hash?: string | null
          id?: string
          installment_info?: string | null
          is_reviewed?: boolean
          original_category?: string | null
          source?: string
          synced_at?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_category?: string | null
          ai_confidence?: number | null
          amount?: number
          bank_account_id?: string | null
          bank_connection_id?: string
          category_source?: string | null
          created_at?: string
          date?: string
          description?: string
          external_id?: string
          hash?: string | null
          id?: string
          installment_info?: string | null
          is_reviewed?: boolean
          original_category?: string | null
          source?: string
          synced_at?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "synced_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "synced_transactions_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          description: string
          id?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_family_invite: {
        Args: { p_display_name: string; p_token: string }
        Returns: string
      }
      create_family: {
        Args: { p_display_name: string; p_name: string }
        Returns: string
      }
      create_family_invite: { Args: never; Returns: string }
      family_overview: {
        Args: never
        Returns: {
          connections: number
          display_name: string
          has_own_pluggy: boolean
          joined_at: string
          last_sync_at: string
          next_consent_expiry: string
          pluggy_connections: number
          problem_connections: number
          reauth_connections: number
          role: string
          user_id: string
        }[]
      }
      is_family_admin: { Args: { p_family: string }; Returns: boolean }
      leave_family: { Args: never; Returns: undefined }
      my_family_id: { Args: never; Returns: string }
      peek_family_invite: {
        Args: { p_token: string }
        Returns: {
          admin_name: string
          family_name: string
          valid: boolean
        }[]
      }
      remove_family_member: { Args: { p_user: string }; Returns: undefined }
      revoke_family_invite: { Args: { p_invite: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
