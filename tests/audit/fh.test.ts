import { it } from "vitest";
import { gpUtiPhc } from "@/engine/cases/gp-uti-phc";
import { converse, messagesOf } from "../helpers";
it("fh", async () => { const { turns } = await converse(gpUtiPhc, ["Take full history"]); console.log(messagesOf(turns[0]!.effects).join("\n")); });
