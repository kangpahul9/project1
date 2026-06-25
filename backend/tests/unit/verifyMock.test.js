jest.mock("../../src/config/db.js");
const pool = require("../../src/config/db.js").default;

test("manual mock provides SQL-routing default", async () => {
  const r1 = await pool.query("SELECT token_version FROM users WHERE id=$1", [1]);
  expect(r1.rows[0].token_version).toBe(0);
});

test("mockReset override restores SQL routing", async () => {
  pool.query.mockReset();
  const r2 = await pool.query("SELECT token_version FROM users WHERE id=$1", [1]);
  expect(r2.rows[0].token_version).toBe(0);
});
