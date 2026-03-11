import { invoke as _invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { debugInvoke } from "./debug-logger";

// Always use debug-instrumented invoke (debug panel can be toggled in UI)
const invoke = debugInvoke as typeof _invoke;

export { invoke, listen, convertFileSrc };
export type { UnlistenFn };
