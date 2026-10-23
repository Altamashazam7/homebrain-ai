"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Film,
  House,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Radio,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { fetchDevices, fetchPlanHistory, generatePlan } from "@/lib/api";
import type { DeviceStatus, HouseholdPlan, PlanSection } from "@/types";
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
