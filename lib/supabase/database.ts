export type ShipmentStatus =
  | "SEOUL_WH"
  | "IN_TRANSIT"
  | "CUSTOMS"
  | "JAKARTA_WH"
  | "DELIVERED";

export type PaymentStatus = "UNPAID" | "DP" | "PAID";
export type ProductStatus = "PRE_ORDER" | "OUT_OF_STOCK";

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string;
          order_number: string;
          item_name: string | null;
          quantity: number | null;
          total_price: number | null;
          payment_status: PaymentStatus | null;
          user_id: string | null;
          product_id: string | null;
        };
        Insert: {
          id?: string;
          order_number: string;
          item_name?: string | null;
          quantity?: number | null;
          total_price?: number | null;
          payment_status?: PaymentStatus | null;
          user_id?: string | null;
          product_id?: string | null;
        };
        Update: {
          id?: string;
          order_number?: string;
          item_name?: string | null;
          quantity?: number | null;
          total_price?: number | null;
          payment_status?: PaymentStatus | null;
          user_id?: string | null;
          product_id?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          title: string;
          slug: string | null;
          category: string | null;
          price: number;
          image_url: string | null;
          status: ProductStatus;
        };
        Insert: {
          id?: string;
          title: string;
          slug?: string | null;
          category?: string | null;
          price: number;
          image_url?: string | null;
          status?: ProductStatus;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string | null;
          category?: string | null;
          price?: number;
          image_url?: string | null;
          status?: ProductStatus;
        };
        Relationships: [];
      };
      shipments: {
        Row: {
          id: string;
          order_id: string;
          tracking_number: string;
          current_status: ShipmentStatus;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          tracking_number: string;
          current_status?: ShipmentStatus;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          tracking_number?: string;
          current_status?: ShipmentStatus;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      shipment_logs: {
        Row: {
          id: string;
          shipment_id: string;
          status_title: ShipmentStatus;
          location: string;
          description: string;
          timestamp: string;
        };
        Insert: {
          id?: string;
          shipment_id: string;
          status_title: ShipmentStatus;
          location: string;
          description: string;
          timestamp?: string;
        };
        Update: {
          id?: string;
          shipment_id?: string;
          status_title?: ShipmentStatus;
          location?: string;
          description?: string;
          timestamp?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
