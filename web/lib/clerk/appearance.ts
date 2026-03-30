/**
 * Shared Clerk `appearance` for embedded sign-in/up.
 * Pass `dark` from `next-themes` when `resolvedTheme === "dark"` after mount.
 */
export function clerkEmbeddedAppearance(dark: boolean) {
  return {
    variables: {
      colorBackground: dark ? "#020617" : "#ffffff",
      colorInputBackground: dark ? "#0f172a" : "#ffffff",
      colorText: dark ? "#f1f5f9" : "#0f172a",
      colorTextSecondary: dark ? "#94a3b8" : "#64748b",
      colorNeutral: dark ? "#334155" : "#e2e8f0",
      colorPrimary: "#0ea5e9",
    },
    elements: {
      rootBox: "w-full",
      card: "shadow-none border-0 rounded-none w-full",
      cardBox: "w-full shadow-none",
      ...(dark
        ? {
            card: "shadow-none border-0 rounded-none w-full !bg-slate-900",
            headerTitle: "text-slate-100",
            headerSubtitle: "text-slate-400",
            formFieldLabel: "text-slate-300",
            formFieldInput:
              "bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500",
            formButtonPrimary: "bg-sky-600 hover:bg-sky-500",
            footer: "text-slate-400",
            socialButtonsBlockButton: "border-slate-600 bg-slate-800 text-slate-100",
            dividerLine: "bg-slate-700",
            dividerText: "text-slate-400",
            identityPreviewText: "text-slate-200",
            formFieldInputShowPasswordButton: "text-slate-400",
          }
        : {}),
    },
  };
}
