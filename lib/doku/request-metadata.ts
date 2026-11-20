import { randomUUID } from "node:crypto";

export function createDokuRequestId() {
  return randomUUID();
}

export function createDokuRequestTimestamp(now = new Date()) {
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}
