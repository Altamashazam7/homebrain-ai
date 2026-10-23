export type PlanSection = "security_plan" | "energy_plan" | "entertainment_plan";
export type PlanIntent =
  | "travel"
  | "family"
  | "newborn"
  | "event"
  | "work_schedule"
  | "energy_saving"
  | "home_security"
  | "general";

export interface PlanContent {
  security_plan: string[];
  energy_plan: string[];
  entertainment_plan: string[];
  ai_summary: string;
  alexa_automations: string[];
  intent_category: PlanIntent;
}

export interface HouseholdPlan extends PlanContent {
  id: number;
  goal: string;
  created_at: string;
}

export interface DeviceStatus {
  name: string;
  category: string;
  status: "online" | "standby" | "attention";
  detail: string;
  battery_percent: number | null;
}
