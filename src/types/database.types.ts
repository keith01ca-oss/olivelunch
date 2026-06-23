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
      parents: {
        Row: {
          id: string
          clerk_user_id: string
          stripe_customer_id: string | null
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
          stripe_customer_id?: string | null
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
          stripe_customer_id?: string | null
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
          name: string
          category: 'main' | 'side' | 'drink' | 'snack'
          price_regular: number
          price_vip: number
          sort_order: number
          is_active: boolean
          deleted_at: string | null
          created_at: string
          updated_at: string
          has_large: boolean
          large_name: string | null
          large_price_regular: number | null
          large_price_vip: number | null
        }
        Insert: {
          id?: string
          name: string
          category: 'main' | 'side' | 'drink' | 'snack'
          price_regular: number
          price_vip: number
          sort_order?: number
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
          has_large?: boolean
          large_name?: string | null
          large_price_regular?: number | null
          large_price_vip?: number | null
        }
        Update: {
          id?: string
          name?: string
          category?: 'main' | 'side' | 'drink' | 'snack'
          price_regular?: number
          price_vip?: number
          sort_order?: number
          is_active?: boolean
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
          has_large?: boolean
          large_name?: string | null
          large_price_regular?: number | null
          large_price_vip?: number | null
        }
      }
      orders: {
        Row: {
          id: string
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
    }
  }
}
