export const PACK_URL =
  "https://raw.githubusercontent.com/OpenSource-For-Freedom/minecraft/main/data/EduCraftClient.mrpack";
export const PACK_VERSION = "1.2.1";

// Bump whenever /server/terms or /server/privacy changes in substance.
// Every consent row records which version the parent saw.
export const TERMS_VERSION = "2026-10-12";

export const PRICE_CENTS = 1000;
export const PRICE_LABEL = "$10";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.app").replace(/\/$/, "");
}

export function registrationPaused(): boolean {
  return process.env.REGISTRATION_PAUSED === "1";
}

export function contactEmail(): string {
  return process.env.EDUCRAFT_CONTACT_EMAIL || process.env.MAIL_REPLY_TO || "";
}

export function joinStepsText(realmAddress: string): string {
  return [
    "1. Install the Modrinth App (https://modrinth.com/app), Prism Launcher or ATLauncher.",
    `2. Download the EduCraft pack and import it into that launcher: ${PACK_URL}`,
    "3. Sign in with the Microsoft account that owns your child's Minecraft Java Edition.",
    "4. Press Play on the EduCraft instance (not plain Minecraft).",
    `5. Choose Multiplayer, then Add Server, and enter: ${realmAddress}`
  ].join("\n");
}
