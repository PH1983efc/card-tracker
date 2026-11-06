#!/usr/bin/env node
// Read-only diagnostic for the source_snapshots metadata CHECK failure.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const TARGET_PROJECT_ID = "wispy-water-47339452";
const TARGET_BRANCH_ID = "br-red-violet-awyxzkjv";
const TARGET_DATABASE = "neondb";
const TARGET_SCHEMA = "public";
const EXPORT_FILE = "google-sheets-export-2026-10-29T12-51-45-107Z-684fc25b-4121-4a2c-a57b-8a79870b9f3c.json";
const EXPORT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "outputs", EXPORT_FILE);
const CAPTURED_TABS = [
  { name: "Master", rows: 53071, cols: 26 },
  { name: "Donruss", rows: 2376, cols: 22 },
  { name: "Topps Now", rows: 999, cols: 26 },
  { name: "Extra Collections", rows: 998, cols: 24 },
  { name: "Orders", rows: 1000, cols: 26 },
];

let currentStage = "startup";
const sensitiveValues = new Set([EXPORT_PATH, process.cwd()]);

class DiagnosticError extends Error {}
function assert(condition, message) {
  if (!condition) throw new DiagnosticError(message);
}
function safeError(error, stage = currentStage) {
  const name = ["Error", "TypeError", "RangeError", "SyntaxError", "DiagnosticError"].includes(error?.name)
    ? error.name
    : "Error";
  const codeValue = error?.code ?? error?.cause?.code;
  const code = typeof codeValue === "string" && (/^[A-Z0-9]{5}$/.test(codeValue) || ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].includes(codeValue))
    ? ` code=${codeValue}`
    : "";
  const statusValue = error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status ?? error?.cause?.response?.status;
  const status = Number.isInteger(statusValue) && statusValue >= 100 && statusValue <= 599
    ? ` HTTP=${statusValue}`
    : "";
  let message = stage === "export JSON parsing"
    ? "Saved export JSON is invalid."
    : typeof error?.message === "string" ? error.message : "No safe error message available";
  message = message
    .replace(/\b(?:https?|postgres(?:ql)?):\/\/[^\s"'<>]+/gi, "[URL redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\b(password|token|secret|private[_ -]?key|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\{[^{}]{0,4000}\}/g, "[JSON redacted]")
    .replace(/\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]*/g, "[PATH redacted]");
  for (const value of [process.env.NEON_TEST_DATABASE_URL, process.env.NEON_API_KEY, ...sensitiveValues]) {
    if (value) message = message.split(value).join("[REDACTED]");
  }
  message = message.replace(/[\r\n\t]+/g, " ").slice(0, 300);
  return `${name}${code}${status}: ${message}`;
}
function parseTestConnectionConfig(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new DiagnosticError("NEON_TEST_DATABASE_URL is invalid.");
  }
  assert(["postgres:", "postgresql:"].includes(parsed.protocol), "Testing database URL must use PostgreSQL.");
  assert(parsed.hostname && parsed.hostname.toLowerCase().endsWith(".neon.tech"), "Testing database URL is not a Neon endpoint.");
  assert(parsed.hash === "", "Testing database URL must not contain a fragment.");
  assert(parsed.port === "" || parsed.port === "5432", "Testing database URL must use the Neon PostgreSQL port.");
  const parameters = [...parsed.searchParams.entries()];
  assert(parameters.every(([name]) => ["sslmode", "channel_binding"].includes(name)), "Testing database URL contains an unexpected or conflicting connection parameter.");
  for (const name of ["sslmode", "channel_binding"]) {
    const values = parameters.filter(([parameter]) => parameter === name).map(([, value]) => value.toLowerCase());
    assert(values.length <= 1, `Testing database URL contains a duplicate ${name} parameter.`);
    if (name === "sslmode" && values.length) {
      assert(["require", "verify-full"].includes(values[0]), "Testing database URL contains an unsafe or unsupported SSL mode.");
    }
    if (name === "channel_binding" && values.length) {
      assert(values[0] === "require", "Testing database URL must require SCRAM channel binding.");
    }
  }
  let database, username, password;
  try {
    database = decodeURIComponent(parsed.pathname.slice(1));
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new DiagnosticError("Testing database URL fields are malformed.");
  }
  assert(database === TARGET_DATABASE, "Connection database does not match neondb.");
  assert(username && password, "Testing database URL must contain its assigned user and password.");
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: TARGET_DATABASE,
    username,
    password,
  };
}
function makeMetadata(data) {
  assert(data?.exportFormat === "google-sheets-grid-v1", "Approved export format is unexpected.");
  assert(typeof data.exportedAt === "string", "Approved export timestamp is missing.");
  return {
    export_format: data.exportFormat,
    export_filename: EXPORT_FILE,
    exported_at: data.exportedAt,
    spreadsheet_title: data.sourceSpreadsheetTitle ?? null,
    captured_tabs: CAPTURED_TABS.map(({ name, rows, cols }) => ({ name, rows, columns: cols })),
    trailing_blank_policy: "omitted from database archive; retained in unchanged export",
  };
}

async function verifyNeonBranchEndpoint(hostname, apiKey) {
  const endpoint = "https://console.neon.tech/api/v2/projects/" + encodeURIComponent(TARGET_PROJECT_ID) + "/branches/" + encodeURIComponent(TARGET_BRANCH_ID) + "/endpoints";
  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json", authorization: "Bearer " + apiKey },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    const wrapped = new DiagnosticError("Could not verify the validation branch with the Neon management API.");
    wrapped.cause = error;
    throw wrapped;
  }
  if (!response.ok) {
    const error = new DiagnosticError("Neon did not verify the expected validation branch.");
    error.status = response.status;
    throw error;
  }
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    const wrapped = new DiagnosticError("Neon branch verification returned an invalid response.");
    wrapped.cause = error;
    throw wrapped;
  }
  const matches = Array.isArray(payload?.endpoints)
    ? payload.endpoints.filter((item) => typeof item?.host === "string" && item.host.toLowerCase() === hostname.toLowerCase())
    : [];
  assert(matches.length === 1 && matches[0].type === "read_write", "Connection host is not the unique read-write endpoint for the expected validation branch.");
}

async function main() {
  currentStage = "configuration";
  const connectionString = process.env.NEON_TEST_DATABASE_URL;
  const apiKey = process.env.NEON_API_KEY;
  assert(connectionString && apiKey, "Set NEON_TEST_DATABASE_URL and NEON_API_KEY using Node's --env-file option.");

  currentStage = "export loading";
  const exportText = await readFile(EXPORT_PATH, "utf8");
  currentStage = "export JSON parsing";
  const exportData = JSON.parse(exportText);
  currentStage = "metadata reconstruction";
  const metadata = makeMetadata(exportData);
  const metadataJson = JSON.stringify(metadata);
  sensitiveValues.add(metadataJson);
  if (typeof metadata.spreadsheet_title === "string") sensitiveValues.add(metadata.spreadsheet_title);

  currentStage = "connection URL validation";
  const connectionConfig = parseTestConnectionConfig(connectionString);
  currentStage = "Neon API branch verification";
  await verifyNeonBranchEndpoint(connectionConfig.host, apiKey);
  currentStage = "database client configuration";
  const sql = postgres({
    ...connectionConfig,
    ssl: "verify-full",
    channel_binding: "require",
    max: 1,
    max_pipeline: 1,
    connect_timeout: 10,
    connection: {
      application_name: "everton-card-tracker-source-snapshots-diagnostic",
      options: "-c default_transaction_read_only=on",
    },
  });

  let client = null;
  let transactionStarted = false;
  let failure = null;
  const cleanupFailures = [];
  const results = {};

  try {
    currentStage = "connection reserve";
    client = await sql.reserve();
    currentStage = "read-only transaction start";
    transactionStarted = true;
    const begin = await client.unsafe("BEGIN READ ONLY");
    assert(begin.command === "BEGIN", "Database did not confirm BEGIN READ ONLY.");

    currentStage = "read-only session verification";
    const settings = await client.unsafe("SELECT current_setting('default_transaction_read_only') AS default_read_only, current_setting('transaction_read_only') AS transaction_read_only");
    assert(settings[0]?.default_read_only === "on" && settings[0]?.transaction_read_only === "on", "Database session is not confirmed read-only.");
    results.readOnly = "confirmed";

    currentStage = "database identity verification";
    const identity = await client.unsafe("SELECT current_database() AS database_name, current_schema() AS schema_name");
    assert(identity[0]?.database_name === TARGET_DATABASE, "Connected database is not neondb.");
    assert(identity[0]?.schema_name === TARGET_SCHEMA, "Connected schema is not public.");
    results.identity = { database: identity[0].database_name, schema: identity[0].schema_name };

    currentStage = "constraint inspection";
    const constraints = await client.unsafe(
      "SELECT conname, pg_get_constraintdef(oid, true) AS definition FROM pg_constraint WHERE conrelid = 'public.source_snapshots'::regclass AND contype = 'c' AND conname = 'source_snapshots_metadata_is_object'"
    );
    results.checkConstraint = constraints.map(({ conname, definition }) => ({ name: conname, definition }));

    currentStage = "column type inspection";
    const column = await client.unsafe(
      "SELECT format_type(a.atttypid, a.atttypmod) AS data_type FROM pg_attribute AS a WHERE a.attrelid = 'public.source_snapshots'::regclass AND a.attname = 'source_metadata' AND a.attnum > 0 AND NOT a.attisdropped"
    );
    results.sourceMetadataType = column[0]?.data_type ?? "column missing";

    currentStage = "importer metadata JSON type check";
    const jsonType = await client.unsafe("SELECT jsonb_typeof($1::jsonb) AS json_type", [metadata]);
    results.importerMetadataJsonType = jsonType[0]?.json_type ?? null;
    currentStage = "parsed metadata JSON type diagnostic";
    const parsedType = await client.unsafe("SELECT jsonb_typeof($1::jsonb) AS parsed_type", [metadata]);
    results.parsed_type = parsedType[0]?.parsed_type ?? null;

    currentStage = "trigger inspection";
    const triggers = await client.unsafe(
      "SELECT tgname AS name, pg_get_triggerdef(oid, true) AS definition FROM pg_trigger WHERE tgrelid = 'public.source_snapshots'::regclass AND NOT tgisinternal ORDER BY tgname"
    );
    results.userDefinedTriggers = triggers.map(({ name, definition }) => ({ name, definition }));
  } catch (error) {
    failure = { stage: currentStage, error };
  } finally {
    if (client && transactionStarted) {
      currentStage = "rollback";
      try {
        const rollback = await client.unsafe("ROLLBACK");
        assert(rollback.command === "ROLLBACK", "Database did not confirm ROLLBACK.");
        transactionStarted = false;
      } catch (error) {
        cleanupFailures.push({ stage: currentStage, error });
      }
    }
    if (client) {
      currentStage = "connection release";
      try {
        await client.release();
      } catch (error) {
        cleanupFailures.push({ stage: currentStage, error });
      }
    }
    currentStage = "client shutdown";
    try {
      await sql.end({ timeout: 10 });
    } catch (error) {
      cleanupFailures.push({ stage: currentStage, error });
    }
  }

  if (failure || cleanupFailures.length) {
    if (failure) console.error(`Diagnostic failed at ${failure.stage}: ${safeError(failure.error, failure.stage)}.`);
    for (const issue of cleanupFailures) console.error(`Cleanup failed at ${issue.stage}: ${safeError(issue.error, issue.stage)}.`);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ ...results, rollback: "confirmed" }, null, 2));
}

main().catch((error) => {
  console.error(`Diagnostic failed at ${currentStage}: ${safeError(error)}.`);
  process.exitCode = 1;
});