/** What the doctor is waiting on, from what they just sent: said on the waiting bar and read out by screen readers. */
export function waitLabel(input: string | null | undefined): string {
  const t = (input ?? "").toLowerCase();
  if (/\?\s*$|^(?:any|do|does|did|how|what|when|where|why|are|is|have|has|tell|since)\b/.test(t)) return "Patient is replying…";
  if (/\b(?:examine|exam|o\/e|auscultate|palpate|percuss|look at|check (?:jvp|chest|abdomen|heart|pulse|pedal)|listen)\b/.test(t)) return "Examining patient…";
  if (/\b(?:cbc|rft|lft|abg|ecg|cxr|x-?ray|usg|ultrasound|ct|mri|echo|trop\w*|test|tests|culture|blood|urine|lipid|report|investigat\w*|send|order)\b/.test(t)) return "Running lab & imaging orders…";
  if (/\b(?:give|start|inj|iv|im|po|mg|mcg|ml|tab|tablet|infusion|bolus|neb|oxygen|o2|stat|prescribe|apply)\b/.test(t)) return "Nurse administering medication…";
  return "Patient is replying…";
}
