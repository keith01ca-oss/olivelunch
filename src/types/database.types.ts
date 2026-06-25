export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          clerk_org_id: string | null
          name: string
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_subscription_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_org_id?: string | null
          name: string
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_org_id?: string | null
          name?: string
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      parents: {
        Row: {
          id: string
          clerk_user_id: string
          org_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          vip_cancel_at: string | null
          vip_cancel_at_period_end: boolean
          email: string
          name: string
          phone: string | null
          is_vip: boolean
          referral_code: string | null
          referred_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          org_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          vip_cancel_at?: string | null
          vip_cancel_at_period_end?: boolean
          email: string
          name: string
          phone?: string | null
          is_vip?: boolean
          referral_code?: string | null
          referred_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          org_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          vip_cancel_at?: string | null
          vip_cancel_at_period_end?: boolean
          email?: string
          name?: string
          phone?: string | null
          is_vip?: boolean
          referral_code?: string | null
          referred_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      schools: {
        Row: {
          id: string
          org_id: string
          name: string
          is_active: boolean
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          is_active?: boolean
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          is_active?: boolean
        }
      }
      routes: {
        Row: {
          id: string
          org_id: string
          route_number: string
        }
        Insert: {
          id?: string
          org_id: string
          route_number: string
        }
        Update: {
          id?: string
          org_id?: string
          route_number?: string
        }
      }
      school_routes: {
        Row: {
          school_id: string
          route_id: string
          stop_order: number
        }
        Insert: {
          school_id: string
          route_id: string
          stop_order?: number
        }
        Update: {
          school_id?: string
          route_id?: string
          stop_order?: number
        }
      }
      children: {
        Row: {
          id: string
          parent_id: string
          name: string
          school_id: string
          division: string
          delivery_location: string | null
          lunch_time: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          parent_id: string
          name: string
          school_id: string
          division: string
          delivery_location?: string | null
          lunch_time?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          name?: string
          school_id?: string
          division?: string
          delivery_location?: string | null
          lunch_time?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      dishes: {
        Row: {
          id: string
          org_id: string
          name: string
          category: 'main' | 'side' | 'drink' | 'snack'
          price_regular: number
          price_vip: number
          sort_order: number
          is_active: boolean
          recipe_url: string | null
          ingredients: Json
          instructions: string | null
          overhead_costs: Json
          prep_time_minutes: number
          cook_time_minutes: number
          pack_time_seconds: number
          has_large: boolean
          large_name: string | null
          large_price_regular: number | null
          large_price_vip: number | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          category: 'main' | 'side' | 'drink' | 'snack'
          price_regular: number
          price_vip: number
          sort_order?: number
          is_active?: boolean
          recipe_url?: string | null
          ingredients?: Json
          instructions?: string | null
          overhead_costs?: Json
          prep_time_minutes?: number
          cook_time_minutes?: number
          pack_time_seconds?: number
          has_large?: boolean
          large_name?: string | null
          large_price_regular?: number | null
          large_price_vip?: number | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          category?: 'main' | 'side' | 'drink' | 'snack'
          price_regular?: number
          price_vip?: number
          sort_order?: number
          is_active?: boolean
          recipe_url?: string | null
          ingredients?: Json
          instructions?: string | null
          overhead_costs?: Json
          prep_time_minutes?: number
          cook_time_minutes?: number
          pack_time_seconds?: number
          has_large?: boolean
          large_name?: string | null
          large_price_regular?: number | null
          large_price_vip?: number | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      menus: {
        Row: {
          id: string
          org_id: string | null
          date: string
          dish_id: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          date: string
          dish_id: string
        }
        Update: {
          id?: string
          org_id?: string | null
          date?: string
          dish_id?: string
        }
      }
      coupons: {
        Row: {
          id: string
          org_id: string
          code: string
          type: 'fixed' | 'percentage'
          amount: number
          usage_limit: number | null
          used_count: number
          is_active: boolean
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          code: string
          type: 'fixed' | 'percentage'
          amount: number
          usage_limit?: number | null
          used_count?: number
          is_active?: boolean
          start_date: string
          end_date: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          code?: string
          type?: 'fixed' | 'percentage'
          amount?: number
          usage_limit?: number | null
          used_count?: number
          is_active?: boolean
          start_date?: string
          end_date?: string
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          org_id: string
          parent_id: string
          child_id: string
          order_date: string
          gross_amount: number
          credit_used: number
          total_amount: number
          coupon_id: string | null
          status: 'pending' | 'paid' | 'cancelled' | 'refunded'
          stripe_session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          parent_id: string
          child_id: string
          order_date: string
          gross_amount: number
          credit_used?: number
          total_amount: number
          coupon_id?: string | null
          status?: 'pending' | 'paid' | 'cancelled' | 'refunded'
          stripe_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          parent_id?: string
          child_id?: string
          order_date?: string
          gross_amount?: number
          credit_used?: number
          total_amount?: number
          coupon_id?: string | null
          status?: 'pending' | 'paid' | 'cancelled' | 'refunded'
          stripe_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          dish_id: string
          quantity: number
          unit_price: number
          total_price: number
          delivery_area: 'classroom' | 'office' | 'pickup'
          is_large: boolean
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          dish_id: string
          quantity: number
          unit_price: number
          total_price: number
          delivery_area?: 'classroom' | 'office' | 'pickup'
          is_large?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          dish_id?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          delivery_area?: 'classroom' | 'office' | 'pickup'
          is_large?: boolean
          created_at?: string
        }
      }
      credits: {
        Row: {
          id: string
          parent_id: string
          amount: number
          source: 'referral' | 'coupon' | 'refund' | 'manual' | 'season_proration' | 'order_usage'
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          parent_id: string
          amount: number
          source: 'referral' | 'coupon' | 'refund' | 'manual' | 'season_proration' | 'order_usage'
          order_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          parent_id?: string
          amount?: number
          source?: 'referral' | 'coupon' | 'refund' | 'manual' | 'season_proration' | 'order_usage'
          order_id?: string | null
          created_at?: string
        }
      }
      blocked_dates: {
        Row: {
          id: string
          org_id: string | null
          date: string
          reason: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          date: string
          reason: string
        }
        Update: {
          id?: string
          org_id?: string | null
          date?: string
          reason?: string
        }
      }
      pro_d_ranges: {
        Row: {
          id: string
          start_date: string
          end_date: string
          message: string
        }
        Insert: {
          id?: string
          start_date: string
          end_date: string
          message: string
        }
        Update: {
          id?: string
          start_date?: string
          end_date?: string
          message?: string
        }
      }
      date_warnings: {
        Row: {
          id: string
          date: string
          message: string
        }
        Insert: {
          id?: string
          date: string
          message: string
        }
        Update: {
          id?: string
          date?: string
          message?: string
        }
      }
      recipes: {
        Row: {
          id: string
          org_id: string
          name: string
          ingredients: Json
          instructions: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          ingredients?: Json
          instructions?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          ingredients?: Json
          instructions?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      dashboard_messages: {
        Row: {
          id: string
          org_id: string
          message: string
          type: 'info' | 'warning' | 'success'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          message: string
          type?: 'info' | 'warning' | 'success'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          message?: string
          type?: 'info' | 'warning' | 'success'
          is_active?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}
