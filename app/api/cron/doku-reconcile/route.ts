import { NextRequest, NextResponse } from "next/server";
import { getDokuCheckoutStatus } from "@/lib/doku/check-status";
import { getDokuConfig } from "@/lib/doku/config";
import {
  handleDokuReconcile,
  type DokuReconciliationClient,
} from "@/lib/doku/reconcile-handler";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

function createReconciliationClient(): DokuReconciliationClient {
  const supabase = createServiceRoleSupabaseClient();
  return {
    async recover() {
      const { error } = await supabase.rpc(
        "doku_recover_creating_payment_attempts",
      );
      return { error };
    },
    async list(limit) {
      const { data, error } = await supabase.rpc(
        "doku_list_reconciliation_candidates",
        { p_limit: limit },
      );
      return { data, error };
    },
    async record(args) {
      const { error } = await supabase.rpc(
        "doku_record_reconciliation",
        args,
      );
      return { error };
    },
    async defer(args) {
      const { error } = await supabase.rpc(
        "doku_defer_payment_reconciliation",
        args,
      );
      return { error };
    },
  };
}

export async function GET(request: NextRequest) {
  const response = await handleDokuReconcile(request, {
    getConfig: getDokuConfig,
    createClient: createReconciliationClient,
    getStatus: getDokuCheckoutStatus,
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
