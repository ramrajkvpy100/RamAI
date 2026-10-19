import { notFound } from "next/navigation";

import { SkillsLab } from "@/components/practice/skills-lab";

/** Development only: the Skills Lab without signing in. */
export default function SkillsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-4xl px-4">
      <SkillsLab stats={[]} />
    </div>
  );
}
