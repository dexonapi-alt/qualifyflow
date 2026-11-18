import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ApiError } from "./api";
import { Icon } from "./UI";
const FieldErrors = createContext<Record<string, string>>({});
const FormIdentity = createContext("");

export function Form({
  onSave,
  children,
  label,
  feedback,
}: {
  onSave: (data: Record<string, string>) => Promise<void | string>;
  children: ReactNode;
  label: string;
  feedback?: string;
}) {
  const formId = useId();
  const [error, setError] = useState<ApiError | null>(null),
    [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) summary.current?.focus();
  }, [error]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError(null);
    setConfirmation("");
    try {
      const result = await onSave(
        Object.fromEntries(new FormData(form).entries()) as Record<
          string,
          string
        >,
      );
      form.reset();
      if (typeof result === "string") setConfirmation(result);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e
          : new ApiError(
              e instanceof Error
                ? e.message
                : "Operation failed. Please retry.",
            ),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <form aria-label={label} onSubmit={submit}>
      {error && (
        <div className="error" role="alert" tabIndex={-1} ref={summary}>
          <strong>{error.message}</strong>
          {Object.entries(error.fields).map(([key, value]) => (
            <p key={key}>
              <a href={"#" + formId + "-" + key}>
                {key.replaceAll("_", " ")}: {value}
              </a>
            </p>
          ))}
          {error.reference && <small>Reference {error.reference}</small>}
        </div>
      )}
      <FieldErrors.Provider value={error?.fields || {}}>
        <FormIdentity.Provider value={formId}>
          <fieldset disabled={pending}>
            {children}
            <button type="submit">{pending ? "Saving…" : label}</button>
          </fieldset>
        </FormIdentity.Provider>
      </FieldErrors.Provider>
      {!pending && !error && (confirmation || feedback) && (
        <div className="action-confirmation" role="status">
          <Icon name="check" size={16} />
          <span>{confirmation || feedback}</span>
        </div>
      )}
    </form>
  );
}
export function Field({
  name,
  label,
  type = "text",
  required = true,
  defaultValue,
  children,
  minLength,
  help,
  autoComplete,
  inputMode,
  maxLength,
  pattern,
  multiline = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  children?: ReactNode;
  minLength?: number;
  help?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "email";
  maxLength?: number;
  pattern?: string;
  multiline?: boolean;
}) {
  const error = useContext(FieldErrors)[name];
  const fieldId = useContext(FormIdentity) + "-" + name;
  const state = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby":
      [error ? fieldId + "-error" : "", help ? fieldId + "-help" : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {children ? (
        <select
          {...state}
          id={fieldId}
          name={name}
          required={required}
          defaultValue={defaultValue}
        >
          {children}
        </select>
      ) : multiline ? (
        <textarea
          {...state}
          id={fieldId}
          name={name}
          required={required}
          defaultValue={defaultValue}
          minLength={minLength}
          maxLength={maxLength}
          rows={4}
        />
      ) : (
        <input
          {...state}
          id={fieldId}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          minLength={minLength}
          autoComplete={
            autoComplete ||
            (type === "password" ? "current-password" : undefined)
          }
          inputMode={inputMode}
          maxLength={maxLength}
          pattern={pattern}
          title={
            pattern
              ? help ||
                (pattern === "[0-9]{6}"
                  ? "Enter the six-digit code from your authenticator app."
                  : "Use the format described for this field.")
              : undefined
          }
        />
      )}
      {error && (
        <small id={fieldId + "-error"} className="danger">
          {error}
        </small>
      )}
      {help && (
        <small className="field-help" id={fieldId + "-help"}>
          {help}
        </small>
      )}
    </div>
  );
}
export function State({ value }: { value: string }) {
  const pending = [
    "pending",
    "pending_approval",
    "awaiting_client",
    "awaiting_internal_approval",
    "awaiting_documents",
    "needs_more_information",
    "missing",
    "quarantined",
    "queued",
    "onboarding",
  ];
  const working = [
    "in_review",
    "needs_review",
    "processing",
    "scanning",
    "assigned",
    "active",
    "submitted",
  ];
  const complete = [
    "verified",
    "reviewed_accepted",
    "review_complete",
    "resolved",
    "closed",
    "approved",
    "completed",
    "accepted",
    "delivered",
    "opened_in_portal",
  ];
  const alert = [
    "expired",
    "scan_failed",
    "validation_failed",
    "failed",
    "dead_letter",
    "suspended",
    "rejected",
    "reviewed_rejected",
    "needs_attention",
    "escalated",
  ];
  const family = pending.includes(value)
    ? "pending"
    : working.includes(value)
      ? "working"
      : complete.includes(value)
        ? "complete"
        : alert.includes(value)
          ? "alert"
          : "neutral";
  const label =
    (
      {
        blocked_by_policy: "Review blocked",
        quarantined: "Awaiting scan",
        reviewed_accepted: "Accepted evidence",
        reviewed_rejected: "Rejected evidence",
      } as Record<string, string>
    )[value] || value.replaceAll("_", " ");
  return (
    <span className={"state " + value + " state--" + family}>{label}</span>
  );
}
