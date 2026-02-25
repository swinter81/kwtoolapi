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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          owner_email: string
          rate_limit_per_min: number
          tier: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          owner_email: string
          rate_limit_per_min?: number
          tier?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          owner_email?: string
          rate_limit_per_min?: number
          tier?: string | null
        }
        Relationships: []
      }
      application_programs: {
        Row: {
          application_number: string | null
          communication_object_count: number | null
          confidence_score: number | null
          created_at: string | null
          id: string
          knx_application_id: string
          knx_program_id: string | null
          manufacturer_id: string | null
          max_group_address_links: number | null
          name: string | null
          product_id: string | null
          source_count: number | null
          status: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          application_number?: string | null
          communication_object_count?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id: string
          knx_application_id: string
          knx_program_id?: string | null
          manufacturer_id?: string | null
          max_group_address_links?: number | null
          name?: string | null
          product_id?: string | null
          source_count?: number | null
          status?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          application_number?: string | null
          communication_object_count?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          knx_application_id?: string
          knx_program_id?: string | null
          manufacturer_id?: string | null
          max_group_address_links?: number | null
          name?: string | null
          product_id?: string | null
          source_count?: number | null
          status?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_programs_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_programs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dpts: {
        Row: {
          description: string | null
          dpt_id: string
          encoding_description: string | null
          id: string
          main_number: number
          name: string
          number: string
          range_high: string | null
          range_low: string | null
          size_bits: number | null
          sub_number: number
          unit: string | null
        }
        Insert: {
          description?: string | null
          dpt_id: string
          encoding_description?: string | null
          id: string
          main_number: number
          name: string
          number: string
          range_high?: string | null
          range_low?: string | null
          size_bits?: number | null
          sub_number: number
          unit?: string | null
        }
        Update: {
          description?: string | null
          dpt_id?: string
          encoding_description?: string | null
          id?: string
          main_number?: number
          name?: string
          number?: string
          range_high?: string | null
          range_low?: string | null
          size_bits?: number | null
          sub_number?: number
          unit?: string | null
        }
        Relationships: []
      }
      hardware_program_mappings: {
        Row: {
          application_program_id: string | null
          id: string
          knx_hw2prog_id: string
          product_id: string | null
          status: string | null
        }
        Insert: {
          application_program_id?: string | null
          id: string
          knx_hw2prog_id: string
          product_id?: string | null
          status?: string | null
        }
        Update: {
          application_program_id?: string | null
          id?: string
          knx_hw2prog_id?: string
          product_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hardware_program_mappings_application_program_id_fkey"
            columns: ["application_program_id"]
            isOneToOne: false
            referencedRelation: "application_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hardware_program_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          application_program_count: number | null
          confidence_score: number | null
          country: string | null
          created_at: string | null
          hex_code: string
          id: string
          knx_manufacturer_id: string
          name: string | null
          product_count: number | null
          short_name: string | null
          source_count: number | null
          status: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          application_program_count?: number | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string | null
          hex_code: string
          id: string
          knx_manufacturer_id: string
          name?: string | null
          product_count?: number | null
          short_name?: string | null
          source_count?: number | null
          status?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          application_program_count?: number | null
          confidence_score?: number | null
          country?: string | null
          created_at?: string | null
          hex_code?: string
          id?: string
          knx_manufacturer_id?: string
          name?: string | null
          product_count?: number | null
          short_name?: string | null
          source_count?: number | null
          status?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          bus_current_ma: number | null
          confidence_score: number | null
          created_at: string | null
          description: string | null
          id: string
          is_coupler: boolean | null
          is_ip_device: boolean | null
          is_power_supply: boolean | null
          knx_hardware_id: string | null
          knx_product_id: string
          manufacturer_id: string | null
          medium_types: string[] | null
          name: string | null
          order_number: string | null
          source_count: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          bus_current_ma?: number | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          id: string
          is_coupler?: boolean | null
          is_ip_device?: boolean | null
          is_power_supply?: boolean | null
          knx_hardware_id?: string | null
          knx_product_id: string
          manufacturer_id?: string | null
          medium_types?: string[] | null
          name?: string | null
          order_number?: string | null
          source_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          bus_current_ma?: number | null
          confidence_score?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_coupler?: boolean | null
          is_ip_device?: boolean | null
          is_power_supply?: boolean | null
          knx_hardware_id?: string | null
          knx_product_id?: string
          manufacturer_id?: string | null
          medium_types?: string[] | null
          name?: string | null
          order_number?: string | null
          source_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
