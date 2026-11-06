import assert from "node:assert/strict";
import test from "node:test";

let overviewHelpers = {};

try {
  overviewHelpers = await import(
    "../components/user/dashboard-overview-data.ts"
  );
} catch (error) {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "ERR_MODULE_NOT_FOUND"
  ) {
    throw error;
  }
}

function getHelper(name) {
  const helper = overviewHelpers[name];
  assert.equal(typeof helper, "function", `${name} should be exported`);
  return helper;
}

test("uses a trimmed profile name, then email, then a customer fallback", () => {
  const getOverviewDisplayName = getHelper("getOverviewDisplayName");

  assert.equal(getOverviewDisplayName("  Chandra Gulo  ", "user@example.com"), "Chandra Gulo");
  assert.equal(getOverviewDisplayName(null, "user@example.com"), "user@example.com");
  assert.equal(getOverviewDisplayName("   ", null), "Pelanggan");
});

test("normalizes absent exact counts to zero without changing actual counts", () => {
  const normalizeOverviewCounts = getHelper("normalizeOverviewCounts");

  assert.deepEqual(
    normalizeOverviewCounts({
      catalogOrders: 4,
      forwarding: 2,
      unpaid: 1,
    }),
    { catalogOrders: 4, forwarding: 2, unpaid: 1 },
  );
  assert.deepEqual(
    normalizeOverviewCounts({
      catalogOrders: null,
      forwarding: 0,
      unpaid: null,
    }),
    { catalogOrders: 0, forwarding: 0, unpaid: 0 },
  );
});

test("uses pending orders as the unpaid payment status", () => {
  assert.equal(overviewHelpers.UNPAID_PAYMENT_STATUS, "pending");
});

test("encodes an order ID in its existing detail route", () => {
  const getOrderDetailHref = getHelper("getOrderDetailHref");

  assert.equal(getOrderDetailHref("order/with space"), "/user/orders/order%2Fwith%20space");
});

test("offers quick actions only for the existing catalog, cart, and profile routes", () => {
  assert.deepEqual(
    overviewHelpers.OVERVIEW_QUICK_ACTIONS?.map(({ href }) => href),
    ["/catalog", "/user/cart", "/user/profile"],
  );
});

test("keeps loading state ahead of error and loaded content", () => {
  const getOverviewViewState = getHelper("getOverviewViewState");

  assert.equal(getOverviewViewState(true, true, 3), "loading");
});

test("shows errors before an empty result", () => {
  const getOverviewViewState = getHelper("getOverviewViewState");

  assert.equal(getOverviewViewState(false, true, 0), "error");
});

test("uses the empty state when no recent orders exist", () => {
  const getOverviewViewState = getHelper("getOverviewViewState");

  assert.equal(getOverviewViewState(false, false, 0), "empty");
});

test("shows the ready state when recent orders exist", () => {
  const getOverviewViewState = getHelper("getOverviewViewState");

  assert.equal(getOverviewViewState(false, false, 1), "ready");
});
