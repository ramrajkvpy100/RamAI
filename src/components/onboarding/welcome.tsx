"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LipButton } from "@/components/games/game-parts";
import { Icon } from "@/components/ui/icon";
import { Mascot, MedicalIcon, SPECIALTY_LABEL, SpecialtyGrid, type MedicalIconName } from "@/components/ui/medical-icons";
import { ALL_SPECIALTIES } from "@/engine/progression";
import { SYNAPSE_BOARDS } from "@/lib/games/synapses";
import { PROBE_CASES } from "@/lib/games/probe";
import { tap } from "@/lib/haptics";
import { SKILL_COUNTS } from "@/lib/skill-counts";
import { FLOWCHARTS } from "@/lib/tools/flowcharts";
import { MNEMONICS } from "@/lib/tools/mnemonics";

export const DREAM_KEY = "ramai.dream";
export const WELCOME_DONE = "ramai.welcome.done";
const BRANCHES = [...ALL_SPECIALTIES, "Radiology", "Anesthesiology"];

const PILLARS: { icon: MedicalIconName; title: string; line: string }[] = [
  { icon: "clinical-games", title: "Clinical Case Drills", line: "Pattern recognition across all major specialties" },
  { icon: "image-rush", title: "Image Rush", line: "Radiology, Dermatology & Ophthalmology spotter practice" },
  { icon: "notes", title: "Flashcard Sets", line: "From your notes, flowcharts and lectures" },
  { icon: "flowcharts", title: "Daily Plans", line: "Short focused sessions you set for yourself each day" },
];

const PROMISES = [
  "Accurate and exam relevant",
  "Mnemonics and flowcharts for every topic",
  "Flashcards that bring back what you're forgetting",
  "Structured explanations for every topic",
  "Visual explanations for every topic",
  "Built on trusted medical sources",
];

/** Four optional steps. A dream branch is kept on this device, and nothing here is required to use the app. */
export function Welcome() {
  const [step, setStep] = useState(0);
  const [branch, setBranch] = useState<string | null>(null);
  useEffect(() => {
    try {
      setBranch(localStorage.getItem(DREAM_KEY));
    } catch {}
  }, []);
  const next = () => {
    tap();
    if (step === 0 && branch) {
      try {
        localStorage.setItem(DREAM_KEY, branch);
      } catch {}
    }
    setStep((s) => s + 1);
    document.querySelector(".welcome-bg")?.scrollTo({ top: 0 });
  };
  const finish = () => {
    try {
      localStorage.setItem(WELCOME_DONE, "1");
    } catch {}
  };
  const name = branch ? (SPECIALTY_LABEL[branch] ?? branch) : "Your branch";
  const inside = Object.values(SKILL_COUNTS).reduce((n, x) => n + x, 0);
  return (
    <div className="welcome-bg fixed inset-0 z-[90] overflow-y-auto text-white">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          {step > 0 ? <button type="button" onClick={() => setStep((s) => s - 1)} aria-label="Back" className="p-1"><Icon name="arrow-left" size={20} /></button> : <span className="w-7" />}
          <div className="flex h-1.5 flex-1 gap-1">{[0, 1, 2, 3].map((n) => <span key={n} className={`flex-1 rounded-full ${n <= step ? "bg-white" : "bg-white/25"}`} />)}</div>
          <Link href="/" onClick={finish} className="text-[14px] font-medium text-white/80">Skip</Link>
        </div>

        <div key={step} className="flex flex-1 animate-rise flex-col py-6">
          {step === 0 && (
            <>
              <h1 className="text-[26px] leading-[32px] font-extrabold">What&apos;s your dream branch?</h1>
              <p className="mt-1 mb-5 text-[15px] text-white/75">Or the rotation you&apos;re on now.</p>
              <SpecialtyGrid items={BRANCHES} selected={branch} onPick={(s) => { tap(); setBranch(s); }} />
            </>
          )}
          {step === 1 && (
            <>
              <div className="mb-4 flex justify-center"><MedicalIcon name={branch === "Radiology" ? "radiology" : "clinical-games"} size={72} /></div>
              <h1 className="text-center text-[26px] leading-[33px] font-extrabold">{name} is a dream branch 🙌</h1>
              <p className="mt-2 mb-5 text-center text-[16px] leading-6 text-white/85">And yes, it&apos;s competitive. RamAI helps you get there.</p>
              <div className="flex flex-col gap-2.5">
                {PILLARS.map((p) => (
                  <div key={p.title} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                    <MedicalIcon name={p.icon} />
                    <div className="min-w-0">
                      <p className="text-[15.5px] font-bold">{p.title}</p>
                      <p className="text-[13.5px] leading-[19px] text-white/75">{p.line}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="mb-4 flex justify-center"><Mascot size={112} /></div>
              <h1 className="text-center text-[25px] leading-[32px] font-extrabold">AI built for your exam &amp; casualty duty, not for everything else.</h1>
              <ul className="mt-5 flex flex-col gap-3">
                {PROMISES.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-[15.5px] leading-[22px]">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[#08152B]"><Icon name="check" size={15} /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="text-center text-[26px] leading-[33px] font-extrabold">What&apos;s waiting inside</h1>
              <div className="mt-5 rounded-3xl bg-white p-5 text-[#14233d] shadow-xl">
                <p className="text-[17px] leading-[26px] font-semibold">Real practice for the wards, in the minutes you actually have:</p>
                <ul className="mt-3 flex flex-col gap-1.5 text-[15.5px] leading-[23px]">
                  <li><b>{inside.toLocaleString("en-IN")}</b> Skills Lab drills</li>
                  <li><b>{SYNAPSE_BOARDS.length}</b> Synapses boards and <b>{PROBE_CASES.length}</b> Probe mysteries</li>
                  <li><b>{MNEMONICS.length}</b> visual mnemonics and <b>{FLOWCHARTS.length}</b> flowcharts</li>
                  <li>Unlimited variety of <b>AI patients</b>, marked by code</li>
                </ul>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-center">
                <Laurel />
                <p className="max-w-[210px] text-[14.5px] leading-5 font-semibold">Built for Doctors, Interns &amp; PG Aspirants</p>
                <Laurel flip />
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-[max(12px,env(safe-area-inset-bottom))]">
        {step < 3 ? (
          <LipButton onClick={next} disabled={step === 0 && !branch} className="w-full disabled:bg-[#27508f] disabled:opacity-100 [--lip:#1d4ed8]">CONTINUE</LipButton>
        ) : (
          <Link href="/cases" onClick={finish} className="btn-lip flex min-h-12 w-full items-center justify-center rounded-2xl bg-accent text-[15px] font-bold tracking-wide text-on-accent [--lip:#1d4ed8]">LET&apos;S GET STARTED</Link>
        )}
        </div>
      </div>
    </div>
  );
}

function Laurel({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 32 64" width="28" height="56" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M26 62C12 54 5 40 8 22 9 14 12 8 16 3" fill="none" stroke="#ffd166" strokeWidth="1.800" strokeLinecap="round" />
      {[[10, 50, -40], [6, 41, -25], [5, 31, -10], [7, 21, 8], [11, 12, 24]].map(([x, y, r]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="3" ry="7" fill="#ffd166" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {[[19, 54, 50], [14, 45, 38], [12, 35, 25], [13, 25, 12], [16, 15, 32]].map(([x, y, r]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2.600" ry="6" fill="#f6c343" transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}
