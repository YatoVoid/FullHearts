import { tick } from "@/lib/jobs";

if (process.env.NEXT_PHASE !== "phase-production-build" && process.env.FULLHEARTS_DISABLE_JOBS !== "1") {
  const timer = setInterval(() => void tick(), 30_000);
  timer.unref();
}
