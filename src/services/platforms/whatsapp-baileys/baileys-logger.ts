import pino from "pino";

/** Shared pino logger for the Baileys socket and everything that touches it (e.g. media downloads). */
export const baileysLogger = pino({ level: process.env.NODE_ENV === "production" ? "warn" : "info" });
