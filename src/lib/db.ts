import postgres from "postgres";

// Production is deliberately the only environment allowed to use DATABASE_URL.
// Local development and Vercel Preview must use the isolated testing database.
const globalForDb = globalThis as typeof globalThis & {
  __evertonTrackerSql?: ReturnType<typeof postgres>;
};

export function getDb() {
  if (globalForDb.__evertonTrackerSql) return globalForDb.__evertonTrackerSql;

  const isProduction = process.env.VERCEL_ENV === "production";
  const connectionString = isProduction
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL_TEST;

  if (!connectionString) {
    const requiredName = isProduction ? "DATABASE_URL" : "DATABASE_URL_TEST";
    throw new Error(`Missing ${requiredName}. The database connection is not configured for this environment.`);
  }

  globalForDb.__evertonTrackerSql = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "verify-full",
    channel_binding: "require",
    prepare: false,
    connection: { application_name: "everton-card-tracker-web" },
  });

  return globalForDb.__evertonTrackerSql;
}
