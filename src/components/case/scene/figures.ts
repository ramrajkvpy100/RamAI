import type { CaseState, PatientStatus } from "@/engine/types";

/** A stable look for this patient across sessions. */
export const figureSeed = (state: CaseState) => `${state.patient.name ?? ""}-${state.patient.age}-${state.patient.sex}-${state.patient.city}`;

/** The patient's status at a given sim minute, from the observed history. */
export function statusAt(state: CaseState, at: number): PatientStatus {
  const history = state.statusHistory?.length ? state.statusHistory : [{ at: 0, status: state.patientStatus }];
  let status = history[0]!.status;
  for (const h of history) if (h.at <= at) status = h.status;
  return status;
}

/** Visible cues — only from vitals the player has measured. */
export function figureCues(state: CaseState) {
  const temp = state.vitals.temp?.current;
  const rr = state.vitals.rr?.current;
  return {
    fever: !!temp && parseFloat(temp.value) >= 100.4,
    breathless: !!rr && parseFloat(rr.value) >= 24,
  };
}
