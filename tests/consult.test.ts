import { it, expect } from "vitest";
import { consultDepartment as c } from "@/engine/intent";
it("consult requests name a department; ordinary orders aren't consults", () => {
  expect([c("Call cardiology"), c("cardiology consult"), c("get surgery opinion"), c("consult"), c("call the nurse"), c("refer to cardiology"), c("ask about chest pain"), c("examine the chest"), c("Paediatrics consult")]).toEqual(["Cardiology", "Cardiology", "General Surgery", "", null, null, null, null, "Paediatrics"]);
});
