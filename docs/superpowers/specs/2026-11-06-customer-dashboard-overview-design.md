# Customer Dashboard Overview Redesign

## Intent

Replace the static `/user` overview with a responsive, premium navy/ivory/gold customer dashboard that gives a useful, accurate summary and quick access to existing features.

## Goals and non-goals

- Show a personalized greeting, verified order/shipment/payment summaries, recent orders, and only working quick actions.
- Remove the hardcoded warehouse announcement because its source and validity cannot be verified.
- Preserve existing authentication, role guards, business flows, database schema, and all other customer pages.
- Do not imply that catalog orders are proxy orders or that the placeholder Billing page contains invoices.

## Data and behavior

- Use the existing shared Supabase browser client and the current authenticated user.
- Read the customer's nullable profile name with a safe fallback.
- Count `orders` belonging to that user as **Pesanan Katalog**; the current catalog checkout creates these rows and the schema has no proxy/catalog discriminator.
- Count all `shipments` associated with that user's orders, including delivered shipments, as **Forwarding**.
- Count orders whose `payment_status` is `pending` as **Belum Dibayar**; link to existing order details/list, not the placeholder invoice page.
- Show the five newest orders with order number, date, total, payment/order status, and a working detail link.
- Quick actions link only to existing customer routes such as catalog, cart, and profile.
- Handle loading, query errors with retry, and no-order empty state without fabricated values.

## Layout

Use the selected **Focused overview** layout: greeting and all-orders link, three summary cards, recent orders, then quick actions. Keep card spacing consistent and make the grid and order list readable on mobile, tablet, and desktop. The warehouse announcement is omitted.

## Approaches considered

1. **Focused overview (selected):** summary and recent orders lead; quick actions follow. Clear and compact, matching the user's final mockup selection.
2. **Action-led dashboard:** welcome hero and quick actions precede summary and orders. Gives navigation more prominence but pushes account activity lower.
3. **Keep a Proxy Orders count:** rejected because the current schema cannot distinguish proxy orders from catalog checkout orders and would mislabel real data.

## Scope and implementation

Implement within `app/(dashboard)/user/page.tsx` and, only if needed, a component dedicated to this Overview. Reuse existing Supabase client, order status labels, currency formatting, Lucide icons, Tailwind styles, and known routes. Do not edit the shared dashboard layout or other pages.

## Verification

Run the relevant existing test(s), TypeScript check, lint, and production build. Review `git status` and diff to ensure only the Overview and any Overview-specific component changed; do not commit, push, or deploy.
