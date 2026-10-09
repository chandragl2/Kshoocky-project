export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRole = "customer" | "admin";
export type ProductStatus = "active" | "inactive" | "out_of_stock";
export type ProductVariantStatus = "active" | "inactive" | "out_of_stock";
export type InventoryMovementType = "checkout_decrement" | "order_cancel_restore" | "admin_adjustment";
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
      product_option_groups: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          is_required: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          is_required?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          is_required?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_values: {
        Row: {
          id: string;
          product_id: string;
          option_group_id: string;
          value: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          option_group_id: string;
          value: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          option_group_id?: string;
          value?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_values_group_product_fkey";
            columns: ["option_group_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_option_groups";
            referencedColumns: ["id", "product_id"];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          label: string;
          price: number;
          stock: number;
          status: ProductVariantStatus;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          label?: string;
          price: number;
          stock?: number;
          status?: ProductVariantStatus;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          label?: string;
          price?: number;
          stock?: number;
          status?: ProductVariantStatus;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variant_option_values: {
        Row: {
          variant_id: string;
          product_id: string;
          option_group_id: string;
          option_value_id: string;
        };
        Insert: {
          variant_id: string;
          product_id: string;
          option_group_id: string;
          option_value_id: string;
        };
        Update: {
          variant_id?: string;
          product_id?: string;
          option_group_id?: string;
          option_value_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variant_option_values_variant_product_fkey";
            columns: ["variant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id", "product_id"];
          },
          {
            foreignKeyName: "product_variant_option_values_value_product_group_fkey";
            columns: ["option_value_id", "product_id", "option_group_id"];
            isOneToOne: false;
            referencedRelation: "product_option_values";
            referencedColumns: ["id", "product_id", "option_group_id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          id: string;
          variant_id: string;
          order_id: string | null;
          order_item_id: string | null;
          movement_type: InventoryMovementType;
          quantity_delta: number;
          reason: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          variant_id: string;
          order_id?: string | null;
          order_item_id?: string | null;
          movement_type: InventoryMovementType;
          quantity_delta: number;
          reason: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          variant_id?: string;
          order_id?: string | null;
          order_item_id?: string | null;
          movement_type?: InventoryMovementType;
          quantity_delta?: number;
          reason?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
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
          variant_id: string | null;
          variant_sku_snapshot: string | null;
          variant_label_snapshot: string | null;
          variant_options_snapshot: Json | null;
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
          variant_id?: string | null;
          variant_sku_snapshot?: string | null;
          variant_label_snapshot?: string | null;
          variant_options_snapshot?: Json | null;
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
          variant_id?: string | null;
          variant_sku_snapshot?: string | null;
          variant_label_snapshot?: string | null;
          variant_options_snapshot?: Json | null;
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
          {
            foreignKeyName: "order_items_variant_product_fkey";
            columns: ["variant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id", "product_id"];
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
          variant_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          variant_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_id?: string;
          quantity?: number;
          variant_id?: string | null;
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
          {
            foreignKeyName: "cart_items_variant_product_fkey";
            columns: ["variant_id", "product_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id", "product_id"];
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
      admin_create_product_option_group: {
        Args: {
          p_product_id: string;
          p_name: string;
          p_is_required: boolean;
          p_sort_order: number;
        };
        Returns: string;
      };
      admin_create_product_option_value: {
        Args: {
          p_option_group_id: string;
          p_value: string;
          p_sort_order: number;
        };
        Returns: string;
      };
      admin_create_product_variant: {
        Args: {
          p_product_id: string;
          p_sku: string;
          p_label: string;
          p_price: number;
          p_stock: number;
          p_status: ProductVariantStatus;
          p_image_url: string | null;
        };
        Returns: string;
      };
      admin_update_product_variant: {
        Args: {
          p_variant_id: string;
          p_sku: string;
          p_label: string;
          p_price: number;
          p_stock: number;
          p_status: ProductVariantStatus;
          p_image_url: string | null;
        };
        Returns: string;
      };
      admin_set_variant_option_values: {
        Args: { p_variant_id: string; p_option_value_ids: string[] };
        Returns: undefined;
      };
      admin_create_product_variant_with_options: {
        Args: {
          p_product_id: string;
          p_sku: string;
          p_label: string;
          p_price: number;
          p_stock: number;
          p_status: ProductVariantStatus;
          p_image_url: string | null;
          p_option_value_ids: string[];
        };
        Returns: string;
      };
      admin_update_product_variant_with_options: {
        Args: {
          p_variant_id: string;
          p_sku: string;
          p_label: string;
          p_price: number;
          p_stock: number;
          p_status: ProductVariantStatus;
          p_image_url: string | null;
          p_option_value_ids: string[];
        };
        Returns: string;
      };
      cart_add_variant: {
        Args: { p_product_id: string; p_variant_id: string; p_quantity: number };
        Returns: string;
      };
      cart_update_item_quantity: {
        Args: { p_cart_item_id: string; p_quantity: number };
        Returns: undefined;
      };
      cart_remove_item: {
        Args: { p_cart_item_id: string };
        Returns: undefined;
      };
      cart_clear_items: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      checkout_catalog_variant: {
        Args: { p_address_id: string };
        Returns: string;
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
