import { it } from "vitest";
import { gpUtiPhc } from "@/engine/cases/gp-uti-phc";
import { converse, messagesOf } from "../helpers";
it("h", async () => { const { turns } = await converse(gpUtiPhc, ["Hint", "Hint"]); console.log(messagesOf(turns[0]!.effects).join("\n")); });
