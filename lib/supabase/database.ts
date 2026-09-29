export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRole = "customer" | "admin";
export type ProductStatus = "active" | "inactive" | "out_of_stock";
export type PreorderEventStatus = "draft" | "active" | "closed" | "cancelled";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone_number: string;
          avatar_url: string;
          role: ProfileRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone_number: string;
          avatar_url: string;
          role?: ProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone_number?: string;
          avatar_url?: string;
          role?: ProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          category: string | null;
          price: number;
          stock: number;
          image_url: string | null;
          is_catalog: boolean;
          status: ProductStatus;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description?: string | null;
          category?: string | null;
          price: number;
          stock: number;
          image_url?: string | null;
          is_catalog?: boolean;
          status?: ProductStatus;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          category?: string | null;
          price?: number;
          stock?: number;
          image_url?: string | null;
          is_catalog?: boolean;
          status?: ProductStatus;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          image_url: string;
          is_primary: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          image_url: string;
          is_primary: boolean;
          sort_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          image_url?: string;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      preorder_events: {
        Row: {
          id: string;
          title: string;
          slug: string;
          description: string | null;
          cover_image_url: string | null;
          status: PreorderEventStatus;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          description?: string | null;
          cover_image_url?: string | null;
          status?: PreorderEventStatus;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          cover_image_url?: string | null;
          status?: PreorderEventStatus;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      preorder_event_products: {
        Row: {
          id: string;
          event_id: string;
          product_id: string;
          preorder_price: number;
          preorder_stock: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          product_id: string;
          preorder_price?: number;
          preorder_stock?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          product_id?: string;
          preorder_price?: number;
          preorder_stock?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "preorder_event_products_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "preorder_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "preorder_event_products_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          recipient_name: string;
          phone_number: string;
          address_line: string;
          city: string;
          province: string;
          postal_code: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          recipient_name: string;
          phone_number: string;
          address_line: string;
          city: string;
          province: string;
          postal_code: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          recipient_name?: string;
          phone_number?: string;
          address_line?: string;
          city?: string;
          province?: string;
          postal_code?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          order_number: string;
          subtotal: number;
          shipping_fee: number;
          discount: number;
          total_price: number;
          payment_status: string;
          order_status: string;
          shipping_address: Json;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_number: string;
          subtotal: number;
          shipping_fee: number;
          discount: number;
          total_price: number;
          payment_status: string;
          order_status: string;
          shipping_address: Json;
          notes: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_number?: string;
          subtotal?: number;
          shipping_fee?: number;
          discount?: number;
          total_price?: number;
          payment_status?: string;
          order_status?: string;
          shipping_address?: Json;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_title: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_title: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_title?: string;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          payment_method: string | null;
          payment_gateway: string | null;
          transaction_id: string | null;
          gateway_transaction_id: string | null;
          payment_status: string;
          amount: number;
          paid_at: string | null;
          expired_at: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          payment_method?: string | null;
          payment_gateway?: string | null;
          transaction_id?: string | null;
          gateway_transaction_id?: string | null;
          payment_status: string;
          amount: number;
          paid_at?: string | null;
          expired_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          payment_method?: string | null;
          payment_gateway?: string | null;
          transaction_id?: string | null;
          gateway_transaction_id?: string | null;
          payment_status?: string;
          amount?: number;
          paid_at?: string | null;
          expired_at?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          tracking_number: string;
          current_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          tracking_number: string;
          current_status: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          tracking_number?: string;
          current_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      shipment_logs: {
        Row: {
          id: string;
          shipment_id: string;
          status_title: string;
          location: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shipment_id: string;
          status_title: string;
          location?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shipment_id?: string;
          status_title?: string;
          location?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipment_logs_shipment_id_fkey";
            columns: ["shipment_id"];
            isOneToOne: false;
            referencedRelation: "shipments";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_add_preorder_product: {
        Args: {
          p_event_id: string;
          p_product_id: string;
          p_preorder_price: number;
          p_preorder_stock: number;
        };
        Returns: string;
      };
      admin_create_preorder_event: {
        Args: {
          p_title: string;
          p_slug: string;
          p_description: string | null;
          p_cover_image_url: string | null;
          p_starts_at: string | null;
          p_ends_at: string | null;
          p_status: PreorderEventStatus;
        };
        Returns: Database["public"]["Tables"]["preorder_events"]["Row"];
      };
      admin_delete_preorder_event: {
        Args: { p_event_id: string };
        Returns: string;
      };
      admin_delete_preorder_product: {
        Args: { p_event_product_id: string; p_event_id: string };
        Returns: string;
      };
      admin_update_preorder_event: {
        Args: {
          p_event_id: string;
          p_title: string;
          p_slug: string;
          p_description: string | null;
          p_cover_image_url: string | null;
          p_starts_at: string | null;
          p_ends_at: string | null;
          p_status: PreorderEventStatus;
        };
        Returns: Database["public"]["Tables"]["preorder_events"]["Row"];
      };
      admin_update_preorder_product: {
        Args: {
          p_event_product_id: string;
          p_event_id: string;
          p_preorder_price: number;
          p_preorder_stock: number;
        };
        Returns: string;
      };
      admin_add_product_image: {
        Args: {
          p_product_id: string;
          p_image_url: string;
          p_is_primary: boolean;
          p_sort_order: number;
        };
        Returns: string;
      };
      admin_create_product: {
        Args: {
          p_title: string;
          p_description: string | null;
          p_category: string;
          p_price: number;
          p_stock: number;
          p_image_url: string | null;
          p_is_catalog: boolean;
          p_status: ProductStatus;
          p_is_featured: boolean;
          p_slug: string;
        };
        Returns: string;
      };
      admin_delete_product: {
        Args: { p_product_id: string };
        Returns: string;
      };
      admin_delete_product_image: {
        Args: { p_product_id: string; p_image_id: string };
        Returns: string;
      };
      admin_set_primary_product_image: {
        Args: { p_product_id: string; p_image_id: string };
        Returns: string;
      };
      admin_update_product: {
        Args: {
          p_product_id: string;
          p_title: string;
          p_description: string | null;
          p_category: string;
          p_price: number;
          p_stock: number;
          p_image_url: string | null;
          p_is_catalog: boolean;
          p_status: ProductStatus;
          p_is_featured: boolean;
        };
        Returns: string;
      };
      admin_update_product_image_sort_order: {
        Args: {
          p_product_id: string;
          p_image_id: string;
          p_sort_order: number;
        };
        Returns: string;
      };
      admin_update_product_status: {
        Args: { p_product_id: string; p_status: ProductStatus };
        Returns: string;
      };
      admin_update_order_status: {
        Args: { p_order_id: string; p_order_status: string };
        Returns: undefined;
      };
      checkout_catalog: {
        Args: { p_address_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
