"use client";
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { Theme } from "@/lib/brand";
type Context = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function useThemeTool(changeTheme: (theme: Theme) => void) {
  const current = useRef(changeTheme);
  current.current = changeTheme;
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "set_color_theme",
            description:
              "Change the app's visible color theme to light or dark and save this device preference.",
            inputSchema: {
              type: "object",
              properties: {
                theme: { type: "string", enum: ["light", "dark"] },
              },
              required: ["theme"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              const value = input as { theme?: unknown };
              if (
                !value ||
                typeof value !== "object" ||
                Object.keys(value).length !== 1 ||
                (value.theme !== "light" && value.theme !== "dark")
              )
                throw new Error("Expected theme to be light or dark.");
              flushSync(() => current.current(value.theme as Theme));
              return { theme: document.documentElement.dataset.theme };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
}
