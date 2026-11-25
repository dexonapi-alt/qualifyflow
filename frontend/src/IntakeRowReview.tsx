import { useEffect, useRef, useState } from "react";
import { api, type Driver } from "./api";
import { DetailPanel } from "./DetailPanel";
import { Form, Field, State } from "./Forms";
import { Icon } from "./UI";
import { IdentityMark } from "./VisualInformation";

export type IntakeRow = {
  id?: string;
  row_number: number;
  normalized: Record<string, string>;
  status: string;
  reason: string;
  candidate: { name: string; reference: string } | null;
  replacement?: { batch_id: string; item_id: string } | null;
  match?: {
    driver_id: string;
    engagement_id: string;
    reviewer: string;
    reviewed_at: string;
    basis: string;
  } | null;
};
const fields = [
  "client_ref",
  "external_driver_ref",
  "report_type",
  "external_report_ref",
  "reported_at",
];
const names: Record<string, string> = {
  client_ref: "Company reference",
  external_driver_ref: "Driver reference",
  report_type: "Report type",
  external_report_ref: "Report reference",
  reported_at: "Reported date",
};
export function IntakeRowReview({
  row,
  batchId,
  branchId,
  base,
  canReview,
  onClose,
  onChanged,
}: {
  row: IntakeRow;
  batchId: string;
  branchId: string | null;
  base: string;
  canReview: boolean;
  onClose: () => void;
  onChanged: (batch: string, message: string) => Promise<void>;
}) {
  const [query, setQuery] = useState(row.normalized.external_driver_ref),
    [choices, setChoices] = useState<Driver[] | null>(null),
    [choice, setChoice] = useState<Driver | null>(null),
    [error, setError] = useState("");
  const command = useRef(crypto.randomUUID()),
    correction = useRef(crypto.randomUUID());
  const endpoint = base + "/" + batchId + "/items/" + row.id;
  useEffect(() => {
    if (
      !canReview ||
      row.match ||
      row.replacement ||
      row.status === "validation_failed" ||
      row.status === "duplicate_detected"
    )
      return;
    let active = true;
    setChoices(null);
    setError("");
    const timer = setTimeout(
      () =>
        void api<{ items: Driver[] }>(
          base.replace("/intake-batches", "/drivers") + "/search",
          { q: query, offset: 0, limit: 25 },
        )
          .then((r) => {
            if (active)
              setChoices(
                r.items.filter(
                  (d) => !branchId || d.engagement.branch_id === branchId,
                ),
              );
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    query,
    base,
    branchId,
    canReview,
    row.match,
    row.replacement,
    row.status,
  ]);
  const editable =
    canReview &&
    !row.match &&
    !row.replacement &&
    !["attached", "duplicate_detected"].includes(row.status);
  return (
    <DetailPanel
      title={"Review source row " + row.row_number}
      context={row.normalized.external_report_ref || "Received metadata"}
      onClose={onClose}
    >
      <div className="intake-review-state">
        <State value={row.status} />
        <p>{row.reason}</p>
      </div>
      <dl className="intake-source-facts">
        {fields.map((f) => (
          <div key={f}>
            <dt>{names[f]}</dt>
            <dd>{row.normalized[f] || "Not supplied"}</dd>
          </div>
        ))}
      </dl>
      {row.replacement ? (
        <div className="intake-next-record">
          <h3>A corrected receipt exists</h3>
          <p>
            This original row is retained as history. Continue from its
            replacement.
          </p>
          <button
            onClick={() =>
              void onChanged(
                row.replacement!.batch_id,
                "Opened corrected receipt.",
              )
            }
          >
            Open corrected receipt <Icon name="arrow" size={14} />
          </button>
        </div>
      ) : row.match ? (
        <section className="intake-reviewed-match">
          <h3>Driver match recorded</h3>
          <p>{row.match.basis}</p>
          <small>
            {row.match.reviewer} ·{" "}
            {new Date(row.match.reviewed_at).toLocaleString()}
          </small>
          <p>
            Evidence still needs its own upload, scan and authorized review.
          </p>
        </section>
      ) : null}
      {editable && (
        <details className="intake-correction">
          <summary>Correct source metadata</summary>
          <p>
            Create a linked replacement. The original source and its history
            will not be overwritten. Used or reviewed rows cannot be relabeled.
          </p>
          <Form
            label="Record corrected receipt"
            onSave={async (d) => {
              const result = await api<{ id: string }>(
                endpoint + "/corrections",
                {
                  command_id: correction.current,
                  normalized: Object.fromEntries(fields.map((f) => [f, d[f]])),
                  reason: d.reason,
                },
              );
              await onChanged(
                result.id,
                "Corrected receipt created. The original row remains in history.",
              );
            }}
          >
            {fields.map((f) => (
              <Field
                key={f}
                name={f}
                label={names[f]}
                defaultValue={row.normalized[f]}
                type={f === "reported_at" ? "date" : "text"}
                maxLength={200}
              />
            ))}
            <Field
              name="reason"
              label="Verified basis for this correction"
              multiline
              minLength={20}
              maxLength={2000}
            />
          </Form>
        </details>
      )}
      {editable && row.status !== "validation_failed" && (
        <section className="intake-match-review">
          <h3>Confirm the driver match</h3>
          <p>
            Search is only a lookup. Compare the company reference and current
            engagement; a similar name is not evidence of identity.
          </p>
          <label htmlFor="intake-driver-search">
            Find a driver by name or reference
          </label>
          <input
            id="intake-driver-search"
            maxLength={100}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setChoice(null);
            }}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!choices && !error && (
            <p role="status">Searching authorized driver records…</p>
          )}
          {choices?.length === 0 && (
            <p>
              No current records match in this location. Correct the source
              reference or register the verified driver through Drivers first.
            </p>
          )}
          {!!choices?.length && (
            <ul className="intake-driver-choices">
              {choices.map((d) => (
                <li key={d.id}>
                  <button
                    className="quiet"
                    aria-pressed={choice?.id === d.id}
                    onClick={() => {
                      setChoice(d);
                      command.current = crypto.randomUUID();
                    }}
                  >
                    <IdentityMark value={d.first_name + " " + d.last_name} />
                    <span>
                      <strong>
                        {d.first_name} {d.last_name}
                      </strong>
                      <small>
                        {d.reference} ·{" "}
                        {d.engagement.branch_name || "Whole company"}
                      </small>
                    </span>
                    <Icon
                      name={choice?.id === d.id ? "check" : "arrow"}
                      size={16}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {choice &&
            (choice.reference !== row.normalized.external_driver_ref ? (
              <p className="intake-match-warning">
                These references differ. Record the verified source correction
                above before confirming this driver.
              </p>
            ) : (
              <Form
                label="Confirm reviewed driver match"
                onSave={async (d) => {
                  await api(endpoint + "/match", {
                    command_id: command.current,
                    driver_id: choice.id,
                    engagement_id: choice.engagement.id,
                    driver_version: choice.version,
                    engagement_version: choice.engagement.version,
                    verified_driver_reference: d.verified_driver_reference,
                    basis: d.basis,
                  });
                  await onChanged(
                    batchId,
                    "Driver match recorded. Open the file to process supporting evidence.",
                  );
                }}
              >
                <p>
                  Selected reference: <strong>{choice.reference}</strong> ·
                  Engagement started {choice.engagement.start_date}
                </p>
                <Field
                  name="verified_driver_reference"
                  label="Type the verified company driver reference"
                  maxLength={64}
                />
                <Field
                  name="basis"
                  label="Evidence used to verify this match"
                  multiline
                  minLength={20}
                  maxLength={2000}
                />
              </Form>
            ))}
        </section>
      )}
      {row.status === "duplicate_detected" && (
        <p>
          Investigate the existing source receipt. Duplicate rows cannot be
          renamed through correction to bypass duplicate protection.
        </p>
      )}
      {!canReview && (
        <p>
          Recording a correction or match requires an authorized specialist or
          reviewer.
        </p>
      )}
    </DetailPanel>
  );
}
