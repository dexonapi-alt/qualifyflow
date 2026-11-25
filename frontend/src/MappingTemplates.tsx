import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Form, Field } from "./Forms";
import { Icon } from "./UI";

type Mapping = {
  id: string;
  template_id: string;
  revision: number;
  name: string;
  active: boolean;
  columns: string[];
  mapping: Record<string, number>;
  source_batch_id: string;
  created_at: string;
};
function endpoint(base: string) {
  return base.replace("/intake-batches", "/intake-mappings");
}
function useMappings(base: string, branch: string, revision: number) {
  const [rows, setRows] = useState<Mapping[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows(null);
    setError("");
    void api<{ items: Mapping[] }>(
      endpoint(base) + (branch ? "?branch_id=" + branch : ""),
    )
      .then((r) => {
        if (active) setRows(r.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [base, branch, revision]);
  return { rows, error };
}

export function MappingLibrary({
  base,
  branch,
  columns,
  canManage,
  onManual,
  onApply,
}: {
  base: string;
  branch: string;
  columns: string[];
  canManage: boolean;
  onManual: () => void;
  onApply: (mapping: Record<string, number>, revisionId: string) => void;
}) {
  const [revision, refresh] = useState(0),
    [selected, select] = useState("");
  const { rows, error } = useMappings(base, branch, revision);
  const retireCommand = useRef(crypto.randomUUID());
  const row = rows?.find((r) => r.id === selected);
  const compatible =
    row && JSON.stringify(row.columns) === JSON.stringify(columns);
  useEffect(() => {
    select("");
  }, [base, branch, columns]);
  return (
    <section className="mapping-library" aria-label="Saved column mappings">
      <div>
        <Icon name="file" size={17} />
        <div>
          <h4>Use a saved mapping</h4>
          <p>
            Only mappings for this company and intake location appear. Applying
            one still requires a row preview.
          </p>
        </div>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error} You can still map columns manually.
        </p>
      ) : !rows ? (
        <p role="status">Loading saved mappings…</p>
      ) : rows.filter((r) => r.active).length === 0 ? (
        <p>
          No saved mappings here yet. Save one from a recorded spreadsheet
          receipt.
        </p>
      ) : (
        <>
          <div className="mapping-library-controls">
            <label>
              Saved mapping
              <select
                aria-label="Saved mapping"
                value={selected}
                onChange={(e) => {
                  select(e.target.value);
                  retireCommand.current = crypto.randomUUID();
                }}
              >
                <option value="">Choose a saved mapping</option>
                {rows
                  .filter((r) => r.active)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · v{r.revision}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              disabled={!compatible}
              onClick={() => {
                if (row) onApply({ ...row.mapping }, row.id);
              }}
            >
              Apply mapping
            </button>
            <button
              type="button"
              className="quiet"
              onClick={() => refresh((n) => n + 1)}
            >
              Refresh mappings
            </button>
          </div>
          {row && (
            <p role="status">
              {compatible
                ? "Column names and order match. Review the mapped values before confirming receipt."
                : "This spreadsheet has a different column layout. Map it manually; the saved mapping will not be applied."}
            </p>
          )}
          {row && canManage && (
            <details className="mapping-retire">
              <summary>Retire this mapping</summary>
              <p>
                Remove it from future imports. Recorded receipts and older
                revisions stay unchanged.
              </p>
              <Form
                key={row.id}
                label="Retire saved mapping"
                onSave={async (d) => {
                  await api(
                    endpoint(base) + "/" + row.template_id + "/retire",
                    {
                      command_id: retireCommand.current,
                      expected_revision: row.revision,
                      reason: d.reason,
                    },
                  );
                  select("");
                  refresh((n) => n + 1);
                }}
              >
                <Field
                  name="reason"
                  label="Reason for retiring this mapping"
                  multiline
                  minLength={20}
                  maxLength={2000}
                />
              </Form>
            </details>
          )}
        </>
      )}
      <button
        type="button"
        className="quiet mapping-manual"
        onClick={() => {
          select("");
          onManual();
        }}
      >
        Use manual mapping
      </button>
    </section>
  );
}

export function SaveMapping({
  base,
  batchId,
  branch,
}: {
  base: string;
  batchId: string;
  branch: string;
}) {
  const [revision, refresh] = useState(0),
    [selected, select] = useState("");
  const { rows, error } = useMappings(base, branch, revision);
  const command = useRef(crypto.randomUUID());
  return (
    <details className="mapping-save">
      <summary>Save this column mapping</summary>
      <p>
        Reuse this receipt’s column layout for recurring handoffs. Source
        records and driver matches are never included.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Form
        label="Save reusable mapping"
        onSave={async (d) => {
          const current = rows?.find((r) => r.id === selected);
          if (selected && !current)
            throw new Error(
              "Reload saved mappings before updating a revision.",
            );
          await api(endpoint(base), {
            command_id: command.current,
            source_batch_id: batchId,
            name: d.name,
            reason: d.reason,
            template_id: current?.template_id || null,
            expected_revision: current?.revision || null,
          });
          command.current = crypto.randomUUID();
          select("");
          refresh((n) => n + 1);
          return "Mapping saved for this company and intake location.";
        }}
      >
        <label>
          Save as
          <select
            aria-label="Save as"
            value={selected}
            onChange={(e) => {
              select(e.target.value);
              command.current = crypto.randomUUID();
            }}
          >
            <option value="">New saved mapping</option>
            {rows
              ?.filter((r) => r.active)
              .map((r) => (
                <option value={r.id} key={r.id}>
                  New revision of {r.name} · v{r.revision}
                </option>
              ))}
          </select>
        </label>
        <Field name="name" label="Mapping name" minLength={3} maxLength={80} />
        <Field
          name="reason"
          label="Why this mapping is suitable"
          multiline
          minLength={20}
          maxLength={2000}
        />
      </Form>
    </details>
  );
}
