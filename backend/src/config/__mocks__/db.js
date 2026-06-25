// Manual mock for db.js used when tests call jest.mock("...config/db.js") without a factory.
// Routes token_version queries to a success response automatically, so tests that use
// mockResolvedValueOnce for their own route queries don't have auth middleware consume them.
const defaultImpl = (sql) => {
  if (typeof sql === "string" && sql.includes("token_version")) {
    return Promise.resolve({ rows: [{ token_version: 0 }], rowCount: 1 });
  }
  return Promise.resolve({ rows: [], rowCount: 0 });
};

const pool = {
  query: jest.fn().mockImplementation(defaultImpl),
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
};

// After mockReset(), restore the smart default so token_version checks still work.
const originalReset = pool.query.mockReset.bind(pool.query);
pool.query.mockReset = function (...args) {
  originalReset(...args);
  pool.query.mockImplementation(defaultImpl);
  return pool.query;
};

module.exports = { __esModule: true, default: pool };
