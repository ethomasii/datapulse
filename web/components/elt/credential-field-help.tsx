import { parseCredentialHelp } from "@/lib/elt/credential-field-help";

type CredentialFieldHelpProps = {
  help?: string;
  helpUrl?: string;
  className?: string;
};

/** Inline hint under a secret field — text plus optional external how-to link. */
export function CredentialFieldHelp({ help, helpUrl, className = "" }: CredentialFieldHelpProps) {
  const parsed = parseCredentialHelp(help, helpUrl);
  if (!parsed.text && !parsed.url) return null;

  return (
    <p className={`mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400 ${className}`.trim()}>
      {parsed.text ? <span>{parsed.text} </span> : null}
      {parsed.url ? (
        <a
          href={parsed.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          How to get this →
        </a>
      ) : null}
    </p>
  );
}
