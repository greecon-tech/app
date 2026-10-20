// The version of this software, written in when the single file is built (scripts/build-edge-bundle.mjs).
// Run from source it says so.
declare const __AGENT_VERSION__: string | undefined;

export const AGENT_VERSION: string = typeof __AGENT_VERSION__ === "string" ? __AGENT_VERSION__ : "0.0.0+source";
