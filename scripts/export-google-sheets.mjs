#!/usr/bin/env node

import { google } from "googleapis";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const TAB_NAMES = [
  "Master",
  "Donruss",
  "Topps Now",
  "Extra Collections",
  "Orders",
];

const REQUIRED_KEYS = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "SHEET_ID",
];

const READ_ONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFilePath = resolve(repoRoot, ".env.local");
const workspaceRoot = resolve(repoRoot, "..", "..");
const outputDir = resolve(workspaceRoot, "outputs");

function findClosingQuote(value, quote) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === quote && value[index - 1] !== "\\") {
      return index;
    }
  }
  return -1;
}

function parseEnvFile(contents) {
  const parsed = Object.create(null);
  const lines = contents.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    let line = lines[lineIndex].trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();

    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 1) continue;

    const name = line.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;

    let rawValue = line.slice(equalsIndex + 1).trim();
    let value;

    if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
      const quote = rawValue[0];
      let quotedValue = rawValue.slice(1);
      let closingQuote = findClosingQuote(quotedValue, quote);

      while (closingQuote === -1 && lineIndex + 1 < lines.length) {
        lineIndex += 1;
        quotedValue += "\n" + lines[lineIndex];
        closingQuote = findClosingQuote(quotedValue, quote);
      }

      value =
        closingQuote === -1
          ? quotedValue
          : quotedValue.slice(0, closingQuote);
    } else {
      value = rawValue.replace(/\s+#.*$/, "").trim();
    }

    // Existing Sheets configuration commonly stores private-key line breaks
    // as escaped newlines. Normalize them in memory without logging the value.
    parsed[name] = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  }

  return parsed;
}

function columnName(columnNumber) {
  let number = columnNumber;
  let name = "";

  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }

  return name;
}

function quotedFullSheetRange(title, rowCount, columnCount) {
  const escapedTitle = title.replace(/'/g, "''");
  return (
    "'" +
    escapedTitle +
    "'!A1:" +
    columnName(columnCount) +
    rowCount
  );
}

function selectCellData(cell) {
  if (!cell) return null;

  const selected = {};
  for (const field of [
    "userEnteredValue",
    "effectiveValue",
    "formattedValue",
    "userEnteredFormat",
  ]) {
    if (cell[field] !== undefined) selected[field] = cell[field];
  }

  return Object.keys(selected).length > 0 ? selected : null;
}

function expandGrid(sheet, rowCount, columnCount) {
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => ({
    rowNumber: rowIndex + 1,
    cells: Array(columnCount).fill(null),
  }));

  for (const gridData of sheet.data || []) {
    const startRow = gridData.startRow || 0;
    const startColumn = gridData.startColumn || 0;

    for (const [rowOffset, rowData] of (gridData.rowData || []).entries()) {
      const targetRow = rows[startRow + rowOffset];
      if (!targetRow) continue;

      for (const [columnOffset, cell] of (rowData.values || []).entries()) {
        const targetColumn = startColumn + columnOffset;
        if (targetColumn >= columnCount) continue;
        targetRow.cells[targetColumn] = selectCellData(cell);
      }
    }
  }

  return rows;
}

async function loadConfiguration() {
  let envContents;
  try {
    envContents = await readFile(envFilePath, "utf8");
  } catch {
    throw new Error("The local .env.local file is unavailable.");
  }

  const config = parseEnvFile(envContents);
  const missing = REQUIRED_KEYS.filter((name) => !config[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      "Missing required .env.local keys: " + missing.join(", ")
    );
  }

  return config;
}

async function fetchTab(sheets, spreadsheetId, sheetMetadata) {
  const title = sheetMetadata.properties?.title;
  const grid = sheetMetadata.properties?.gridProperties;
  const rowCount = grid?.rowCount;
  const columnCount = grid?.columnCount;

  if (!title || !Number.isInteger(rowCount) || !Number.isInteger(columnCount)) {
    throw new Error("A requested tab has incomplete grid metadata.");
  }

  const range = quotedFullSheetRange(title, rowCount, columnCount);
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [range],
    includeGridData: true,
    fields:
      "sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue,userEnteredFormat(numberFormat)))))",
  });

  const sheet = (response.data.sheets || []).find(
    (candidate) => candidate.properties?.title === title
  );
  if (!sheet) throw new Error("A requested tab could not be read.");

  return {
    title,
    sheetId: sheetMetadata.properties.sheetId,
    rowCount,
    columnCount,
    headerRowNumber: 1,
    rows: expandGrid(sheet, rowCount, columnCount),
  };
}

async function writeExport(exportData) {
  const relativeOutput = relative(repoRoot, outputDir);
  if (
    relativeOutput === "" ||
    (!relativeOutput.startsWith("..") && !isAbsolute(relativeOutput))
  ) {
    throw new Error("The export directory must be outside the Git checkout.");
  }

  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName =
    "google-sheets-export-" + timestamp + "-" + randomUUID() + ".json";
  const outputPath = resolve(outputDir, fileName);
  const temporaryPath = outputPath + ".tmp";

  try {
    await writeFile(temporaryPath, JSON.stringify(exportData, null, 2), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }

  return outputPath;
}

async function main() {
  operationStage = "configuration";
  const config = await loadConfiguration();
  operationStage = "Google API request";
  const auth = new google.auth.JWT({
    email: config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: config.GOOGLE_PRIVATE_KEY,
    scopes: [READ_ONLY_SCOPE],
  });
  const sheetsClient = google.sheets({ version: "v4", auth });

  const metadataResponse = await sheetsClient.spreadsheets.get({
    spreadsheetId: config.SHEET_ID,
    fields:
      "properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  });

  operationStage = "validation";
  const availableSheets = metadataResponse.data.sheets || [];
  const missingTabs = TAB_NAMES.filter(
    (title) =>
      !availableSheets.some((sheet) => sheet.properties?.title === title)
  );
  if (missingTabs.length > 0) {
    throw new Error("One or more required tabs are missing.");
  }

  const tabs = [];
  for (const title of TAB_NAMES) {
    const sheetMetadata = availableSheets.find(
      (sheet) => sheet.properties?.title === title
    );
    operationStage = "Google API request";
    tabs.push(
      await fetchTab(sheetsClient, config.SHEET_ID, sheetMetadata)
    );
  }

  const exportData = {
    exportFormat: "google-sheets-grid-v1",
    exportedAt: new Date().toISOString(),
    sourceSpreadsheetTitle: metadataResponse.data.properties?.title || null,
    sourceDataWasModified: false,
    tabs,
  };

  operationStage = "output write";
  const outputPath = await writeExport(exportData);
  console.log("Read-only export completed: " + outputPath);
}

let operationStage = "configuration";

function safeErrorDiagnostics(error, stage) {
  const shape = error instanceof Error
    ? "Error object"
    : typeof error === "string"
      ? "string"
      : "other";
  const safeNames = new Set([
    "AggregateError",
    "Error",
    "EvalError",
    "FetchError",
    "GaxiosError",
    "GoogleAuthError",
    "RangeError",
    "ReferenceError",
    "SyntaxError",
    "TypeError",
    "URIError",
  ]);
  const allowedCodes = new Map([
    ["invalid_grant", "AuthenticationError"],
    ["invalid_client", "AuthenticationError"],
    ["ERR_JWT_EXPIRED", "AuthenticationError"],
    ["ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "AuthenticationError"],
    ["ENOTFOUND", "NetworkError"],
    ["EAI_AGAIN", "NetworkError"],
    ["ECONNRESET", "NetworkError"],
    ["ETIMEDOUT", "NetworkError"],
    ["ECONNREFUSED", "NetworkError"],
    ["ENOENT", "FilesystemError"],
    ["EACCES", "FilesystemError"],
    ["EPERM", "FilesystemError"],
    ["ENOSPC", "FilesystemError"],
    ["EROFS", "FilesystemError"],
  ]);
  const knownReasons = new Set([
    "accessNotConfigured",
    "authError",
    "badRequest",
    "dailyLimitExceeded",
    "forbidden",
    "insufficientPermissions",
    "invalid",
    "invalidCredentials",
    "notFound",
    "rateLimitExceeded",
    "userRateLimitExceeded",
  ]);

  const chain = [];
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    chain.push(current);
    current = current.cause;
  }

  let name = null;
  let code = null;
  let status = null;
  let reason = null;
  for (const item of chain) {
    if (!name && safeNames.has(item.name)) name = item.name;
    if (!code && allowedCodes.has(item.code)) code = item.code;

    const response = item.response && typeof item.response === "object"
      ? item.response
      : Object.create(null);
    const responseData = response.data && typeof response.data === "object"
      ? response.data
      : Object.create(null);
    const apiError = responseData.error && typeof responseData.error === "object"
      ? responseData.error
      : Object.create(null);
    const statusCandidate = response.status ?? item.statusCode ?? item.status;
    if (
      status === null &&
      Number.isInteger(statusCandidate) &&
      statusCandidate >= 100 &&
      statusCandidate <= 599
    ) status = statusCandidate;

    const possibleReasons = [
      apiError.errors?.[0]?.reason,
      apiError.reason,
      responseData.errors?.[0]?.reason,
    ];
    if (!reason) reason = possibleReasons.find((value) => knownReasons.has(value)) || null;
  }

  let category = "ExportError";
  if (code) category = allowedCodes.get(code);
  else if (status !== null || reason !== null) category = "GoogleApiError";
  else if (stage === "configuration") category = "ConfigurationError";
  else if (stage === "output write") category = "FilesystemError";

  return { shape, name, code, category, stage, status, reason };
}
main().catch((error) => {
  const diagnostic = safeErrorDiagnostics(error, operationStage);
  console.error("Export failed:", JSON.stringify(diagnostic));
  process.exitCode = 1;
});

