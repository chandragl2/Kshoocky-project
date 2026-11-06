import assert from "node:assert/strict";
import test from "node:test";
import { getNavbarAuthView } from "../lib/navbar-auth.ts";

test("keeps account actions pending until the profile role is verified", () => {
  assert.equal(getNavbarAuthView(false, null, null, null), "loading");
  assert.equal(getNavbarAuthView(true, null, null, null), "anonymous");
  assert.equal(
    getNavbarAuthView(true, "customer-id", "customer-id", "customer"),
    "customer",
  );
  assert.equal(
    getNavbarAuthView(true, "admin-id", "admin-id", "admin"),
    "admin",
  );
  assert.equal(getNavbarAuthView(true, "user-id", null, null), "unverified");
  assert.equal(
    getNavbarAuthView(true, "customer-id", "admin-id", "admin"),
    "unverified",
  );
});
