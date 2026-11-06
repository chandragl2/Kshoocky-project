# Customer Dashboard Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `/user` overview with a premium responsive dashboard using current-user profile, order, payment, and shipment data.

**Architecture:** Keep `app/(dashboard)/user/page.tsx` as the route entry and render a client-side `CustomerDashboardOverview` component for authenticated Supabase reads and interaction states. Keep Overview-only display/count helpers in a focused module and use exact head counts plus a five-order recent query so counts do not depend on the page limit.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, shared Supabase browser client, Tailwind CSS, Lucide icons, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-06-customer-dashboard-overview-design.md`

## Global Constraints

- Implement within `app/(dashboard)/user/page.tsx` and, only if needed, a component dedicated to this Overview.
- Do not edit the shared dashboard layout or other pages.
- Preserve existing authentication, role guards, business flows, database schema, and all other customer pages.
- Remove the hardcoded warehouse announcement because its source and validity cannot be verified.
- Do not imply that catalog orders are proxy orders or that the placeholder Billing page contains invoices.
- Do not commit, push, or deploy.

## Review Focus

- Null, undefined, blank, or missing profile name must use a safe greeting fallback — test `getOverviewDisplayName`.
- Successful empty count responses must display zero, while failed queries must show an error instead — test count normalization and verify error state manually/build.
- Only `payment_status = pending` contributes to unpaid count — test `UNPAID_PAYMENT_STATUS`.
- Shipment count must include all current-user shipments, including delivered, and must be scoped through the related order's `user_id` — verify the exact Supabase query and TypeScript types.
- No recent orders must show an empty state; detail links must encode IDs and target the existing order detail route — verify rendering and route construction.

---

### Task 1: Add tested Overview data helpers

**Files:**
- Create: `components/user/dashboard-overview-data.ts`
- Test: `tests/user-dashboard-overview.test.mjs`

**Interfaces:**
- Produces `getOverviewDisplayName(fullName: string | null | undefined, email: string | null | undefined): string`.
- Produces `normalizeOverviewCounts(counts: { catalogOrders: number | null; forwarding: number | null; unpaid: number | null }): { catalogOrders: number; forwarding: number; unpaid: number }`.
- Produces `UNPAID_PAYMENT_STATUS = "pending"` for the payment-count query.
- Produces `getOrderDetailHref(orderId: string): string` and `OVERVIEW_QUICK_ACTIONS` for the working routes `/catalog`, `/user/cart`, and `/user/profile`.

- [ ] **Step 1: Write failing tests** for trimmed profile name, null/blank fallback to email then `"Pelanggan"`, exact count preservation, null counts normalized to zero, pending-only payment status, encoded order-detail IDs, and the three existing quick-action destinations.
- [ ] **Step 2: Run tests and confirm the expected missing-export failures.**

Run: `node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests\user-dashboard-overview.test.mjs`

Expected: FAIL because the Overview helpers are not exported yet.

- [ ] **Step 3: Implement only those helpers** in `components/user/dashboard-overview-data.ts`, importing no Supabase client or page UI.
- [ ] **Step 4: Run the focused test and confirm it passes.**

Run: `node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests\user-dashboard-overview.test.mjs`

Expected: PASS for all helper cases.

### Task 2: Implement the live customer Overview

**Files:**
- Modify: `app/(dashboard)/user/page.tsx`
- Create: `components/user/CustomerDashboardOverview.tsx`
- Modify: `components/user/dashboard-overview-data.ts`
- Test: `tests/user-dashboard-overview.test.mjs`

**Interfaces:**
- Consumes the helpers from Task 1.
- Produces `getOverviewViewState(isLoading: boolean, hasError: boolean, recentOrderCount: number): "loading" | "error" | "empty" | "ready"` with loading, then error, then empty-state precedence.
- `CustomerDashboardOverview` owns overview loading, error/retry, and loaded states; the route page renders it.

- [ ] **Step 1: Write failing tests** for `getOverviewViewState`: loading wins while loading, errors win over empty results, zero recent orders is empty, and a non-empty result is ready.
- [ ] **Step 2: Run focused tests and confirm they fail because the state helper is missing.**
- [ ] **Step 3: Implement `getOverviewViewState`** in `components/user/dashboard-overview-data.ts`.
- [ ] **Step 4: Run focused tests and confirm the state tests pass.**
- [ ] **Step 5: Implement the focused responsive layout**: greeting, exact-count summary cards, recent orders, and functional catalog/cart/profile actions; remove decorative and dead controls, including the stale warehouse announcement.
- [ ] **Step 6: Load data for the authenticated user** using the shared Supabase client: profile name, exact current-user order count, exact pending-order count, exact shipment count through `orders!inner` filtered by the current user's ID, and the five latest orders. Include delivered shipments. Check every query error before normalizing counts; show retryable errors rather than success-shaped zeroes.
- [ ] **Step 7: Render explicit loading, retryable error, and no-order empty states** using `getOverviewViewState`. Show recent order number, Indonesian date, formatted total, payment/order status labels, and use `getOrderDetailHref` for each detail link.
- [ ] **Step 8: Run the focused Overview tests and confirm they pass.**

Run: `node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests\user-dashboard-overview.test.mjs`

Expected: PASS for name/count interpretation, view-state precedence, encoded detail destinations, and existing quick-action destinations.

- [ ] **Step 9: Verify the full change** with TypeScript, lint, all repository Node tests, and production build; review status and both staged/unstaged diffs without staging or committing.

Run:
- `npx tsc --noEmit --incremental false`
- `npm run lint`
- `node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests`
- `npm run build`

Expected: all commands exit successfully; only the Overview route, Overview-specific component/helper, and its test are modified or added.
