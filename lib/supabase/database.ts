import type { OrderStatus } from "../order-status";
import type { ShipmentStatus } from "../shipment-status";

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
export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "refunded" | "cancelled";
export type OrderPaymentStatus = "pending" | "paid" | "failed" | "refunded" | "expired";
export type PaymentSessionState = "creating" | "active" | "uncertain" | "expired" | "cancelled";
export type PreorderEventStatus = "draft" | "active" | "closed" | "cancelled";
export type FeaturedEventMediaType = "image" | "video";

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
      featured_events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          media_type: FeaturedEventMediaType;
          media_url: string;
          thumbnail_url: string | null;
          cta_text: string | null;
          cta_url: string | null;
          is_active: boolean;
          sort_order: number;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          media_type: FeaturedEventMediaType;
          media_url: string;
          thumbnail_url?: string | null;
          cta_text?: string | null;
          cta_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          media_type?: FeaturedEventMediaType;
          media_url?: string;
          thumbnail_url?: string | null;
          cta_text?: string | null;
          cta_url?: string | null;
          is_active?: boolean;
          sort_order?: number;
          starts_at?: string | null;
          ends_at?: string | null;
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
          option_signature: string[] | null;
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
          option_signature?: string[] | null;
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
          option_signature?: string[] | null;
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
          payment_status: OrderPaymentStatus;
          order_status: OrderStatus;
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
          payment_status: OrderPaymentStatus;
          order_status: OrderStatus;
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
          payment_status?: OrderPaymentStatus;
          order_status?: OrderStatus;
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
          gateway_invoice_number: string | null;
          gateway_request_id: string | null;
          gateway_request_body: string | null;
          payment_url: string | null;
          gateway_expires_at: string | null;
          payment_session_state: PaymentSessionState | null;
          next_reconcile_at: string | null;
          reconciliation_error_code: string | null;
          last_notification_status: string | null;
          payment_status: PaymentStatus;
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
          gateway_invoice_number?: string | null;
          gateway_request_id?: string | null;
          gateway_request_body?: string | null;
          payment_url?: string | null;
          gateway_expires_at?: string | null;
          payment_session_state?: PaymentSessionState | null;
          next_reconcile_at?: string | null;
          reconciliation_error_code?: string | null;
          last_notification_status?: string | null;
          payment_status?: PaymentStatus;
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
          gateway_invoice_number?: string | null;
          gateway_request_id?: string | null;
          gateway_request_body?: string | null;
          payment_url?: string | null;
          gateway_expires_at?: string | null;
          payment_session_state?: PaymentSessionState | null;
          next_reconcile_at?: string | null;
          reconciliation_error_code?: string | null;
          last_notification_status?: string | null;
          payment_status?: PaymentStatus;
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
      checkout_idempotency: {
        Row: {
          user_id: string;
          idempotency_key: string;
          address_id: string;
          order_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          idempotency_key: string;
          address_id: string;
          order_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          idempotency_key?: string;
          address_id?: string;
          order_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkout_idempotency_address_id_fkey";
            columns: ["address_id"];
            isOneToOne: false;
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_idempotency_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      doku_webhook_events: {
        Row: {
          id: string;
          gateway: string;
          event_id: string;
          body_digest: string;
          invoice_number: string;
          transaction_status: string;
          outcome: string;
          created_at: string;
          processed_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_note: string | null;
        };
        Insert: {
          id?: string;
          gateway?: string;
          event_id: string;
          body_digest: string;
          invoice_number: string;
          transaction_status: string;
          outcome: string;
          created_at?: string;
          processed_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
        };
        Update: {
          id?: string;
          gateway?: string;
          event_id?: string;
          body_digest?: string;
          invoice_number?: string;
          transaction_status?: string;
          outcome?: string;
          created_at?: string;
          processed_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string | null;
        };
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          tracking_number: string;
          current_status: ShipmentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          tracking_number: string;
          current_status: ShipmentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          tracking_number?: string;
          current_status?: ShipmentStatus;
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
        Args: { p_order_id: string; p_order_status: OrderStatus };
        Returns: undefined;
      };
      admin_create_shipment: {
        Args: { p_order_id: string; p_tracking_number: string };
        Returns: string;
      };
      admin_record_shipment_update: {
        Args: {
          p_shipment_id: string;
          p_status: ShipmentStatus;
          p_location: string | null;
          p_description: string;
        };
        Returns: undefined;
      };

      admin_create_featured_event: {
        Args: {
          p_title: string;
          p_description: string | null;
          p_media_type: FeaturedEventMediaType;
          p_media_url: string;
          p_thumbnail_url: string | null;
          p_cta_text: string | null;
          p_cta_url: string | null;
          p_sort_order: number;
          p_starts_at: string | null;
          p_ends_at: string | null;
        };
        Returns: string;
      };
      admin_update_featured_event: {
        Args: {
          p_event_id: string;
          p_title: string;
          p_description: string | null;
          p_media_type: FeaturedEventMediaType;
          p_media_url: string;
          p_thumbnail_url: string | null;
          p_cta_text: string | null;
          p_cta_url: string | null;
          p_sort_order: number;
          p_starts_at: string | null;
          p_ends_at: string | null;
        };
        Returns: string;
      };
      admin_delete_featured_event: {
        Args: { p_event_id: string };
        Returns: string;
      };
      admin_update_featured_event_status: {
        Args: { p_event_id: string; p_is_active: boolean };
        Returns: string;
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
      admin_update_product_option_group: {
        Args: {
          p_option_group_id: string;
          p_name: string;
          p_is_required: boolean;
          p_sort_order: number;
        };
        Returns: string;
      };
      admin_update_product_option_value: {
        Args: {
          p_option_value_id: string;
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
      checkout_catalog_variant_idempotent: {
        Args: { p_address_id: string; p_idempotency_key: string };
        Returns: string;
      };
      doku_begin_payment: {
        Args: {
          p_order_id: string;
          p_request_id: string;
          p_request_body: string;
          p_expires_at: string;
        };
        Returns: {
          payment_id: string;
          gateway_invoice_number: string;
          gateway_request_id: string;
          gateway_request_body: string;
          payment_status: string;
          payment_session_state: PaymentSessionState;
          payment_url: string | null;
          gateway_expires_at: string;
        }[];
      };
      doku_save_checkout_response: {
        Args: {
          p_payment_id: string;
          p_payment_url: string;
          p_gateway_expires_at: string;
        };
        Returns: undefined;
      };
      doku_mark_payment_uncertain: {
        Args: { p_payment_id: string };
        Returns: undefined;
      };
      doku_get_order_payment_status: {
        Args: { p_order_id: string };
        Returns: {
          order_payment_status: OrderPaymentStatus;
          order_status: string;
          payment_status: PaymentStatus;
          payment_url: string | null;
          payment_expires_at: string | null;
          payment_session_state: PaymentSessionState | null;
        }[];
      };
      doku_list_reconciliation_candidates: {
        Args: { p_limit: number };
        Returns: {
          payment_id: string;
          invoice_number: string;
          original_request_id: string;
          payment_expires_at: string;
          gateway_transaction_id: string | null;
        }[];
      };
      doku_recover_creating_payment_attempts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      doku_list_webhook_incidents: {
        Args: { p_limit: number; p_offset?: number };
        Returns: {
          event_id: string;
          invoice_number: string;
          transaction_status: string;
          outcome: string;
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_note: string | null;
        }[];
      };
      doku_mark_webhook_incident_reviewed: {
        Args: { p_event_id: string; p_review_note: string };
        Returns: boolean;
      };
      doku_defer_payment_reconciliation: {
        Args: { p_payment_id: string; p_error_code: string };
        Returns: undefined;
      };
      doku_expire_payment: {
        Args: {
          p_payment_id: string;
          p_invoice_number: string;
          p_amount: number;
          p_original_request_id: string;
        };
        Returns: string;
      };
      doku_record_notification: {
        Args: {
          p_event_id: string;
          p_body_digest: string;
          p_invoice_number: string;
          p_amount: number;
          p_original_request_id: string | null;
          p_gateway_transaction_id: string | null;
          p_status: string;
          p_event_time: string | null;
        };
        Returns: string;
      };
      doku_record_reconciliation_incident: {
        Args: {
          p_source: "reconciliation" | "notification";
          p_event_id: string | null;
          p_body_digest: string | null;
          p_payment_id: string | null;
          p_order_id: string | null;
          p_invoice_number: string | null;
          p_amount: number | null;
          p_original_request_id: string | null;
          p_gateway_transaction_id: string | null;
          p_existing_gateway_transaction_id: string | null;
          p_gateway_status: string | null;
          p_gateway_transaction_status: string | null;
          p_local_payment_status: string | null;
          p_local_order_payment_status: string | null;
          p_local_order_status: string | null;
          p_local_payment_session_state: string | null;
          p_reason_code: string;
        };
        Returns: string;
      };
      doku_record_reconciliation: {
        Args: {
          p_payment_id: string;
          p_status: string;
          p_invoice_number: string;
          p_amount: number;
          p_original_request_id: string;
          p_gateway_transaction_id: string | null;
        };
        Returns: string;
      };
      doku_restore_order_inventory_once: {
        Args: { p_order_id: string; p_created_by: string | null };
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
