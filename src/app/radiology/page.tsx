import type { Metadata } from "next";

import { RadiologyReporting } from "@/components/radiology/radiology-reporting";
import { PublicPage } from "@/components/shell/public-page";

export const metadata: Metadata = { title: "Radiology", description: "Report real X-rays, CT and ultrasound: from the request form to the diagnosis." };
export const dynamic = "force-dynamic";

/** Radiology reporting — open to everyone. */
export default function RadiologyPage() {
  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-3xl">
        <RadiologyReporting />
      </div>
    </PublicPage>
  );
}
