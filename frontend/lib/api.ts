import type { DeviceStatus, HouseholdPlan } from "@/types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000").replace(/\/+$/, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isHouseholdPlan(value: unknown): value is HouseholdPlan {
  return (
    isRecord(value) &&
    Number.isInteger(value.id) &&
    typeof value.goal === "string" &&
    typeof value.created_at === "string" &&
    Number.isFinite(Date.parse(value.created_at)) &&
    isStringArray(value.security_plan) &&
    isStringArray(value.energy_plan) &&
    isStringArray(value.entertainment_plan)
  );
}

function isDeviceStatus(value: unknown): value is DeviceStatus {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    (value.status === "online" || value.status === "standby" || value.status === "attention") &&
    typeof value.detail === "string" &&
    (value.battery_percent === null ||
      (typeof value.battery_percent === "number" && Number.isFinite(value.battery_percent)))
  );
}

function errorDetail(payload: unknown): string | undefined {
  if (!isRecord(payload) || !("detail" in payload)) return undefined;

  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) {
    const messages = payload.detail.flatMap((item) =>
      isRecord(item) && typeof item.msg === "string" ? [item.msg] : [],
    );
    if (messages.length) return messages.join("; ");
  }
  return undefined;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });

  const responseText = await response.text();
  let payload: unknown;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      if (response.ok) throw new Error("The API returned an invalid response.");
    }
  }
  if (!response.ok) {
    throw new Error(errorDetail(payload) ?? `Request failed (${response.status}).`);
  }
  return payload;
}

export async function fetchDevices(signal?: AbortSignal): Promise<DeviceStatus[]> {
  const payload = await request("/api/devices", { signal });
  if (!Array.isArray(payload) || !payload.every(isDeviceStatus)) {
    throw new Error("The API returned invalid device data.");
  }
  return payload;
}

export async function fetchPlanHistory(signal?: AbortSignal): Promise<HouseholdPlan[]> {
  const payload = await request("/api/plans?limit=8", { signal });
  if (!Array.isArray(payload) || !payload.every(isHouseholdPlan)) {
    throw new Error("The API returned invalid plan history.");
  }
  return payload;
}

export async function generatePlan(goal: string): Promise<HouseholdPlan> {
  const payload = await request("/api/plans", {
    method: "POST",
    body: JSON.stringify({ goal }),
  });
  if (!isHouseholdPlan(payload)) throw new Error("The API returned an invalid plan.");
  return payload;
}
