export async function register(): Promise<void> {
  // This exact `=== "nodejs"` check is what lets Next drop the import from
  // its edge build, where node: modules don't exist.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
