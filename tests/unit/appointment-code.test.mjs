import test from "node:test";
import assert from "node:assert/strict";

// Mirrors the concurrency-safety logic added in src/lib/server/appointments.ts
// (createAppointmentWithUniqueCode retry loop + claimStage decision) and the
// followups claim. The real functions touch Prisma, so we test the pure branches.

class FakeP2002 extends Error {
  constructor() {
    super("Unique constraint failed");
    this.code = "P2002";
  }
}

function isCollision(e) {
  return e instanceof FakeP2002 && e.code === "P2002";
}

async function createWithRetry(createFn, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await createFn(i);
    } catch (e) {
      if (isCollision(e)) continue; // fresh code and retry
      throw e; // any other error is real
    }
  }
  throw new Error("could_not_allocate_appointment_code");
}

/** claimStage / followup claim: the winner is the update that changed exactly 1 row. */
function claimWon(updateCount) {
  return updateCount === 1;
}

test("unique code: succeeds on first attempt", async () => {
  let calls = 0;
  const res = await createWithRetry(async () => {
    calls++;
    return { code: "ABC123" };
  });
  assert.equal(calls, 1);
  assert.deepEqual(res, { code: "ABC123" });
});

test("unique code: retries past collisions then succeeds", async () => {
  let calls = 0;
  const res = await createWithRetry(async (i) => {
    calls++;
    if (i < 2) throw new FakeP2002();
    return { code: `code-${i}` };
  });
  assert.equal(calls, 3);
  assert.deepEqual(res, { code: "code-2" });
});

test("unique code: exhausting attempts throws allocation error", async () => {
  await assert.rejects(
    () => createWithRetry(async () => { throw new FakeP2002(); }, 4),
    /could_not_allocate_appointment_code/,
  );
});

test("unique code: a non-collision error is rethrown immediately", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      createWithRetry(async () => {
        calls++;
        throw new Error("db_down");
      }),
    /db_down/,
  );
  assert.equal(calls, 1); // no retry on non-P2002
});

test("claim: only an update that changed exactly one row wins", () => {
  assert.equal(claimWon(1), true); // this caller claimed it
  assert.equal(claimWon(0), false); // someone else already claimed → skip send
  assert.equal(claimWon(2), false); // defensive: never treat a multi-row update as a win
});
