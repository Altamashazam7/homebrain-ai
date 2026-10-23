"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bot,
  BadgeCheck,
  Check,
  Circle,
  ChevronRight,
  CircleAlert,
  Clock3,
  ClipboardCheck,
  Film,
  House,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Play,
  Radio,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { fetchDevices, fetchPlanHistory, generatePlan } from "@/lib/api";
import type { DeviceStatus, HouseholdPlan, PlanIntent, PlanSection } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const sectionDetails: {
  key: PlanSection;
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  color: string;
  iconBg: string;
}[] = [
  {
    key: "security_plan",
    title: "Security",
    eyebrow: "PEACE OF MIND",
    icon: Shield,
    color: "text-[#2f7b68]",
    iconBg: "bg-[#e8f4ef]",
  },
  {
    key: "energy_plan",
    title: "Energy",
    eyebrow: "SMARTER SAVINGS",
    icon: Zap,
    color: "text-[#bb821f]",
    iconBg: "bg-[#fff4dc]",
  },
  {
    key: "entertainment_plan",
    title: "Entertainment",
    eyebrow: "READY WHEN YOU ARE",
    icon: Film,
    color: "text-[#6570b8]",
    iconBg: "bg-[#eef0ff]",
  },
];

const deviceIcons: Record<string, LucideIcon> = {
  "Alexa+": MessageCircle,
  Ring: Radio,
  "Fire TV": Film,
  Bee: Bot,
};

const intentLabels: Record<PlanIntent, string> = {
  travel: "Travel",
  family: "Family",
  newborn: "Newborn care",
  event: "Hosting an event",
  work_schedule: "Shift schedule",
  energy_saving: "Energy saving",
  home_security: "Home security",
  general: "General household",
};

const simulatedDevices: {
  name: string;
  icon: LucideIcon;
  actions: { name: string; intents: PlanIntent[] }[];
}[] = [
  {
    name: "Alexa+",
    icon: MessageCircle,
    actions: [
      { name: "Vacation Mode", intents: ["travel"] },
      { name: "Party Mode", intents: ["event"] },
      { name: "Quiet Hours Mode", intents: ["newborn", "work_schedule"] },
    ],
  },
  {
    name: "Ring",
    icon: Radio,
    actions: [
      { name: "Enhanced Monitoring", intents: ["travel", "home_security"] },
      { name: "Guest Monitoring", intents: ["event", "family"] },
      { name: "Sleep Protection", intents: ["newborn", "work_schedule"] },
    ],
  },
  {
    name: "Fire TV",
    icon: Film,
    actions: [
      { name: "Relaxation Playlist", intents: ["travel", "newborn", "work_schedule"] },
      { name: "Party Playlist", intents: ["event"] },
      { name: "Family Content", intents: ["family", "newborn"] },
    ],
  },
  {
    name: "Bee",
    icon: Bot,
    actions: [
      {
        name: "Checklist Created",
        intents: [
          "travel",
          "family",
          "newborn",
          "event",
          "work_schedule",
          "energy_saving",
          "home_security",
          "general",
        ],
      },
      {
        name: "Preparation Guide",
        intents: ["travel", "family", "newborn", "event", "work_schedule", "home_security"],
      },
    ],
  },
];

function DeviceActionsPanel({ plan }: { plan: HouseholdPlan }) {
  const [simulatedActions, setSimulatedActions] = useState<Record<string, boolean>>({});
  const [simulationMessage, setSimulationMessage] = useState("");

  return (
    <Card className="mb-4 overflow-hidden border-[#25394c] bg-[#172838] text-white shadow-[0_12px_35px_rgba(23,40,56,0.12)]">
      <CardHeader className="gap-4 border-b border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f6a623] text-[#172838]">
            <Activity className="size-5" />
          </span>
          <div>
            <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-[#f6bd5c]">
              SIMULATED CONTROL LAYER
            </p>
            <CardTitle className="text-white">Device Actions</CardTitle>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-[#d6dee6]">
            Intent: {intentLabels[plan.intent_category]}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff3d8] px-3 py-1.5 text-[10px] font-bold tracking-wide text-[#805612]">
            <span className="size-1.5 rounded-full bg-[#d99b2b]" />
            SIMULATION ONLY
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <p className="mb-4 text-xs leading-5 text-[#aab8c5]">
          Suggested states are matched to this plan. No commands are sent and no devices are changed.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {simulatedDevices.map((device) => {
            const Icon = device.icon;
            const suggestedCount = device.actions.filter((action) =>
              action.intents.includes(plan.intent_category),
            ).length;
            return (
              <div className="rounded-xl border border-white/10 bg-white/[0.055] p-3.5" key={device.name}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-[#f6bd5c]" />
                    <h3 className="truncate text-sm font-semibold text-white">{device.name}</h3>
                  </div>
                  <span className="shrink-0 text-[10px] text-[#9eafbd]">
                    {suggestedCount ? `${suggestedCount} suggested` : "Standby"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {device.actions.map((action) => {
                    const isSuggested = action.intents.includes(plan.intent_category);
                    const isReady = device.name === "Bee";
                    const actionId = `${device.name}:${action.name}`;
                    const isSimulated = simulatedActions[actionId] ?? false;
                    return (
                      <li
                        className={`flex min-h-10 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                          isSimulated
                            ? "border-[#8fcab0]/40 bg-[#8fcab0]/10"
                            : isSuggested
                            ? "border-[#d9ad5e]/35 bg-[#f6a623]/10"
                            : "border-white/[0.07] bg-black/[0.08]"
                        }`}
                        key={action.name}
                      >
                        <span className={`min-w-0 text-xs ${isSuggested ? "font-medium text-white" : "text-[#b0bdc8]"}`}>
                          {action.name}
                        </span>
                        {isSuggested ? (
                          <button
                            aria-label={`${isSimulated ? "Reset" : "Simulate"} ${action.name}`}
                            className={`inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[9px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                              isSimulated
                                ? "text-[#a7d8bf] hover:bg-white/10"
                                : "bg-[#f6a623] text-[#172838] hover:bg-[#ffc45c]"
                            }`}
                            onClick={() => {
                              setSimulatedActions((current) => ({
                                ...current,
                                [actionId]: !isSimulated,
                              }));
                              setSimulationMessage(
                                isSimulated
                                  ? `${action.name} simulation reset.`
                                  : `${action.name} simulated for the ${intentLabels[plan.intent_category]} plan.`,
                              );
                            }}
                            type="button"
                          >
                            {isSimulated ? (
                              <Check aria-hidden="true" className="size-3" />
                            ) : (
                              <Play aria-hidden="true" className="size-3" />
                            )}
                            {isSimulated ? "Simulated" : "Simulate"}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-wide ${
                              isReady ? "text-[#8fcab0]" : "text-[#8393a1]"
                            }`}
                          >
                            {isReady ? (
                              <Check aria-hidden="true" className="size-3" />
                            ) : (
                              <Circle aria-hidden="true" className="size-2" />
                            )}
                            {isReady ? "Ready" : "Standby"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-start gap-2 border-t border-white/10 pt-3 text-[11px] leading-5 text-[#91a2b0]">
          <ClipboardCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#f6bd5c]" />
          <span>
            Status is a plan-based simulation for demonstration only. No real device commands are sent.
            <span aria-live="polite" className="block font-medium text-[#a7d8bf]">
              {simulationMessage}
            </span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({
  plan,
  section,
  isLoading,
}: {
  plan: HouseholdPlan | null;
  section: (typeof sectionDetails)[number];
  isLoading: boolean;
}) {
  const Icon = section.icon;
  const items = plan?.[section.key] ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <p className="text-[10px] font-bold tracking-[0.17em] text-[#98a1aa]">{section.eyebrow}</p>
          <CardTitle className="mt-2">{section.title}</CardTitle>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${section.iconBg}`}>
          <Icon className={`size-5 ${section.color}`} />
        </span>
      </CardHeader>
      <CardContent aria-busy={isLoading}>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm leading-6 text-[#89939d]" role="status">
            <LoaderCircle className="size-4 animate-spin" />
            Loading recommendations...
          </p>
        ) : items.length ? (
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li className="flex gap-2.5 text-sm leading-5 text-[#52606d]" key={`${item}-${index}`}>
                <Check className={`mt-0.5 size-4 shrink-0 ${section.color}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-[#89939d]">
            Your tailored recommendations will appear here after you create a plan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceTile({ device }: { device: DeviceStatus }) {
  const Icon = deviceIcons[device.name] ?? House;
  const isOnline = device.status === "online";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#edf0f3] bg-white p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3f5f7] text-[#556472]">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#273644]">{device.name}</p>
          <span
            className={`size-1.5 shrink-0 rounded-full ${isOnline ? "bg-[#36a47e]" : "bg-[#c9a35b]"}`}
            aria-label={device.status}
          />
        </div>
        <p className="mt-0.5 truncate text-xs text-[#85909a]">{device.detail}</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function Dashboard() {
  const [goal, setGoal] = useState("");
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [history, setHistory] = useState<HouseholdPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<HouseholdPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      const [deviceResult, historyResult] = await Promise.allSettled([
        fetchDevices(controller.signal),
        fetchPlanHistory(controller.signal),
      ]);
      if (controller.signal.aborted) return;

      const errors: string[] = [];
      if (deviceResult.status === "fulfilled") {
        setDevices(deviceResult.value);
      } else {
        errors.push(
          `Device status could not be loaded: ${
            deviceResult.reason instanceof Error ? deviceResult.reason.message : "Unknown error."
          }`,
        );
      }
      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value);
      } else {
        errors.push(
          `Plan history could not be loaded: ${
            historyResult.reason instanceof Error ? historyResult.reason.message : "Unknown error."
          }`,
        );
      }
      setError(errors.join(" "));
      setIsLoading(false);
    }

    void loadDashboard();
    return () => controller.abort();
  }, []);

  const activePlan = selectedPlan ?? history[0] ?? null;

  async function onGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal.trim() || isGenerating) return;
    if (goal.trim().length < 5) {
      setError("Please enter at least 5 non-whitespace characters.");
      return;
    }

    setError("");
    setIsGenerating(true);
    try {
      const plan = await generatePlan(goal.trim());
      setHistory((current) => [plan, ...current.filter((item) => item.id !== plan.id)].slice(0, 8));
      setSelectedPlan(plan);
      setGoal("");
    } catch (generationError) {
      setError(
        generationError instanceof Error ? generationError.message : "Plan generation failed. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen pb-12">
      <header className="border-b border-[#e9edf1] bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <Link className="flex items-center gap-2.5" href="/" aria-label="HomeBrain AI home">
            <span className="grid size-9 place-items-center rounded-xl bg-[#172838] text-[#f6b84d]">
              <House className="size-[18px]" />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-[#182634]">
              homebrain<span className="text-[#e8a02e]">.</span>
            </span>
            <span className="ml-1 hidden rounded-full bg-[#f3f5f7] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#77838f] sm:inline">
              AI HOME
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-[#71808d]">
            <span className="relative flex size-2">
              {devices.length > 0 && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              )}
              <span
                className={`relative inline-flex size-2 rounded-full ${
                  devices.length > 0 ? "bg-emerald-500" : isLoading ? "bg-amber-400" : "bg-slate-400"
                }`}
              />
            </span>
            {isLoading ? "Connecting..." : devices.length > 0 ? "Demo status available" : "Status unavailable"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-5 pt-8 sm:px-8 sm:pt-11">
        <div className="mb-7 flex flex-col justify-between gap-3 sm:mb-9 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a1814b]">
              Your household, in harmony
            </p>
            <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-[#192735] sm:text-[34px]">
              Good to have you home.
            </h1>
            <p className="mt-2 text-sm text-[#7c8791]">
              One thoughtful plan for a home that takes care of itself.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#8b959e]">
            <Clock3 className="size-4" />
            A little more peace of mind, every day
          </div>
        </div>

        <section className="mb-7 overflow-hidden rounded-[22px] bg-[#172838] shadow-[0_12px_35px_rgba(23,40,56,0.11)]">
          <div className="grid grid-cols-1 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between lg:p-9">
              <div className="absolute -left-24 -top-24 size-80 rounded-full border border-white/[0.07]" />
              <div className="absolute -left-12 -top-12 size-56 rounded-full border border-white/[0.07]" />
              <div className="relative z-10 grid size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] text-[#ffc45c]">
                <Sparkles className="size-5" />
              </div>
              <div className="relative z-10 max-w-[330px]">
                <p className="mb-3 text-[10px] font-bold tracking-[0.19em] text-[#f2b547]">
                  YOUR AI HOUSEHOLD COMMAND CENTRE
                </p>
                <h2 className="text-[25px] font-semibold leading-[1.25] tracking-[-0.025em] text-white">
                  A smarter home starts with a simple thought.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#b0bbc5]">
                  Tell us what life looks like. We&apos;ll bring the little things together.
                </p>
              </div>
              <div className="relative z-10 flex items-center gap-2 text-xs text-[#aeb9c3]">
                <LockKeyhole className="size-3.5 text-[#eeb34e]" />
                Recommendations only · no devices are controlled
              </div>
            </div>

            <div className="bg-[#fdfdfd] p-5 sm:p-7 lg:my-3 lg:mr-3 lg:rounded-[17px]">
              <div className="mb-4 flex items-center gap-2 lg:hidden">
                <Sparkles className="size-4 text-[#d89b32]" />
                <p className="text-xs font-semibold text-[#66737f]">What can we help you plan?</p>
              </div>
              <form onSubmit={onGenerate}>
                <label className="mb-2 block text-sm font-semibold text-[#263543]" htmlFor="goal">
                  What&apos;s on your mind?
                </label>
                <Textarea
                  id="goal"
                  minLength={5}
                  maxLength={500}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="I am leaving home for 5 days..."
                  value={goal}
                  aria-describedby="goal-hint"
                  required
                />
                <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <p id="goal-hint" className="flex items-center gap-1.5 text-xs text-[#8b959e]">
                    <Lightbulb className="size-3.5 text-[#d9a03e]" />
                    A goal, a trip, or a small everyday win.
                  </p>
                  <Button className="w-full sm:w-auto" disabled={!goal.trim() || isGenerating} type="submit">
                    {isGenerating ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        Create my plan
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {error && (
          <div
            className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            role="alert"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="mb-8" aria-labelledby="plans-heading">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-[#98a1aa]">MADE FOR YOUR HOME</p>
              <h2 id="plans-heading" className="text-lg font-semibold tracking-tight text-[#1b2a38]">
                Your household plan
              </h2>
            </div>
            {activePlan && (
              <span className="hidden text-xs text-[#8c969f] sm:inline">
                For: <span className="font-medium text-[#566471]">{activePlan.goal}</span>
              </span>
            )}
          </div>
          {activePlan?.ai_summary && (
            <p className="mb-4 rounded-xl border border-[#e8ebef] bg-white px-4 py-3 text-sm leading-6 text-[#52606d]">
              {activePlan.ai_summary}
            </p>
          )}
          {activePlan && (
            <DeviceActionsPanel key={`${activePlan.id}-${activePlan.intent_category}`} plan={activePlan} />
          )}
          {activePlan?.alexa_automations?.length ? (
            <Card className="mb-4 border-[#e8ebef] bg-gradient-to-br from-white to-[#f8f9ff]">
              <CardHeader className="flex-row items-center gap-3 pb-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-[#6570b8]">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <CardTitle>Alexa+ Suggested Automations</CardTitle>
                  <p className="mt-1 text-xs text-[#7c8791]">
                    Optional routine ideas tailored to this plan. Nothing is enabled automatically.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {activePlan.alexa_automations.map((automation) => (
                    <li
                      className="flex min-h-12 items-center gap-2.5 rounded-xl border border-[#edf0f3] bg-white px-3 py-2.5 text-sm font-medium leading-5 text-[#52606d]"
                      key={automation}
                    >
                      <Zap aria-hidden="true" className="size-4 shrink-0 text-[#bb821f]" />
                      <span>{automation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {sectionDetails.map((section) => (
              <SectionCard key={section.key} plan={activePlan} section={section} isLoading={isLoading} />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-[#98a1aa]">THE SIMULATED ECOSYSTEM</p>
                <CardTitle>Device status</CardTitle>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-[#edf7f2] px-2.5 py-1 text-[10px] font-semibold text-[#43846c]">
                <Activity className="size-3" />
                DEMO MODE
              </span>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-[#8b959e]">
                  <LoaderCircle className="size-4 animate-spin" />
                  Connecting to your home...
                </div>
              ) : devices.length ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {devices.map((device) => <DeviceTile device={device} key={device.name} />)}
                </div>
              ) : (
                <p className="text-sm text-[#7c8791]">Device status is not available.</p>
              )}
              <p className="mt-4 text-[11px] leading-5 text-[#9aa3ab]">
                Simulated Amazon ecosystem devices. No real hardware is connected or controlled.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-[#98a1aa]">PICK UP WHERE YOU LEFT OFF</p>
                <CardTitle>Plan history</CardTitle>
              </div>
              <span className="grid size-9 place-items-center rounded-xl bg-[#f3f5f7] text-[#697783]">
                <Clock3 className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-4 text-sm text-[#8b959e]">Loading recent plans...</div>
              ) : history.length ? (
                <ul className="divide-y divide-[#edf0f3]">
                  {history.slice(0, 4).map((plan) => {
                    const isSelected = activePlan?.id === plan.id;
                    return (
                      <li key={plan.id}>
                        <button
                          className={`flex w-full items-center gap-3 py-3 text-left transition-colors ${
                            isSelected ? "text-[#192735]" : "text-[#66737f] hover:text-[#192735]"
                          }`}
                          onClick={() => setSelectedPlan(plan)}
                          type="button"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f4f5f7] text-[#84909a]">
                            {isSelected ? <Check className="size-4 text-[#388269]" /> : <ArrowDownRight className="size-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{plan.goal}</span>
                            <span className="mt-0.5 block text-[11px] text-[#9aa3ab]">{formatDate(plan.created_at)}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-[#b3bbc2]" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="py-4 text-sm leading-6 text-[#89939d]">
                  {error ? "History could not be loaded. Check that the API is running." : "Your saved plans will show up here."}
                </div>
              )}
              {history.length > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9aa3ab]">
                  <span>{history.length} recent {history.length === 1 ? "plan" : "plans"} saved locally</span>
                  <span aria-hidden="true">·</span>
                  <span>most recent first</span>
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-[#e7eaee] pt-5 text-[11px] text-[#9aa3ab] sm:flex-row sm:items-center sm:justify-between">
          <p>HomeBrain AI · Your home, thoughtfully looked after.</p>
          <p className="flex items-center gap-1.5">
            <LockKeyhole className="size-3" />
            AI recommendations are suggestions, not device commands.
          </p>
        </footer>
      </div>
    </main>
  );
}
