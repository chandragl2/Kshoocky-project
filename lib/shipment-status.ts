export const SHIPMENT_STATUS_OPTIONS = [
  { value: "SEOUL_WH", label: "Seoul Warehouse" },
  { value: "IN_TRANSIT", label: "Dalam Perjalanan" },
  { value: "CUSTOMS", label: "Bea Cukai" },
  { value: "JAKARTA_WH", label: "Gudang Jakarta" },
  { value: "DELIVERED", label: "Diterima" },
] as const;

export type ShipmentStatus =
  (typeof SHIPMENT_STATUS_OPTIONS)[number]["value"];

export function nextShipmentStatusOptions(currentStatus: string) {
  const currentIndex = SHIPMENT_STATUS_OPTIONS.findIndex(
    ({ value }) => value === currentStatus,
  );

  return currentIndex < 0
    ? []
    : SHIPMENT_STATUS_OPTIONS.slice(currentIndex + 1);
}

export function shipmentStatusLabel(status: string) {
  return (
    SHIPMENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}
