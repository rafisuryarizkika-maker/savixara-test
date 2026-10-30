
import { assertEquals } from "jsr:@std/assert";

type Job = {
  id: string;
  leaseToken: string;
  status: "running" | "paused" | "completed";
  leaseUntil: string;
};

function pauseJob(
  job: Job,
  jobId: string,
  leaseToken: string,
  now: string,
): Job {
  if (
    job.id !== jobId ||
    job.leaseToken !== leaseToken ||
    job.status !== "running" ||
    Date.parse(job.leaseUntil) <= Date.parse(now)
  ) {
    return job;
  }

  return { ...job, status: "paused" };
}

Deno.test("matching lease can pause a running job", () => {
  const job: Job = {
    id: "job-1",
    leaseToken: "token-1",
    status: "running",
    leaseUntil: "2030-01-01T00:00:00.000Z",
  };

  assertEquals(
    pauseJob(job, "job-1", "token-1", "2029-01-01T00:00:00.000Z").status,
    "paused",
  );
});

Deno.test("stale lease cannot pause a job", () => {
  const job: Job = {
    id: "job-1",
    leaseToken: "token-new",
    status: "running",
    leaseUntil: "2030-01-01T00:00:00.000Z",
  };

  assertEquals(
    pauseJob(job, "job-1", "token-old", "2029-01-01T00:00:00.000Z").status,
    "running",
  );
});

Deno.test("expired lease cannot pause a running job", () => {
  const job: Job = {
    id: "job-1",
    leaseToken: "token-1",
    status: "running",
    leaseUntil: "2029-01-01T00:00:00.000Z",
  };

  assertEquals(
    pauseJob(job, "job-1", "token-1", "2030-01-01T00:00:00.000Z").status,
    "running",
  );
});

Deno.test("completed job stays completed", () => {
  const job: Job = {
    id: "job-1",
    leaseToken: "token-1",
    status: "completed",
    leaseUntil: "2030-01-01T00:00:00.000Z",
  };

  assertEquals(
    pauseJob(job, "job-1", "token-1", "2029-01-01T00:00:00.000Z").status,
    "completed",
  );
});

Deno.test("different job ID cannot be paused", () => {
  const job: Job = {
    id: "job-1",
    leaseToken: "token-1",
    status: "running",
    leaseUntil: "2030-01-01T00:00:00.000Z",
  };

  assertEquals(
    pauseJob(job, "job-other", "token-1", "2029-01-01T00:00:00.000Z").status,
    "running",
  );
});

Deno.test("stale lease cannot release a newer worker lease", () => {
  type Lease = {
    id: string;
    leaseToken: string | null;
    leaseUntil: string | null;
  };

  const current: Lease = {
    id: "job-1",
    leaseToken: "token-new",
    leaseUntil: "2030-01-01T00:00:00.000Z",
  };

  function releaseLease(
    lease: Lease,
    jobId: string,
    leaseToken: string,
  ): Lease {
    if (
      lease.id !== jobId ||
      lease.leaseToken !== leaseToken
    ) {
      return lease;
    }

    return {
      ...lease,
      leaseToken: null,
      leaseUntil: null,
    };
  }

  assertEquals(
    releaseLease(current, "job-1", "token-old"),
    current,
  );
});
    
Deno.test("only one concurrent request can claim a paused job", () => {
  type Job = {
    id: string;
    status: "paused" | "running";
    leaseToken: string | null;
  };

  const original: Job = {
    id: "job-1",
    status: "paused",
    leaseToken: null,
  };

  function claim(
    job: Job,
    jobId: string,
    token: string,
  ): { job: Job; claimed: boolean } {
    if (
      job.id !== jobId ||
      job.status !== "paused" ||
      job.leaseToken !== null
    ) {
      return { job, claimed: false };
    }

    return {
      job: {
        ...job,
        status: "running",
        leaseToken: token,
      },
      claimed: true,
    };
  }

  const first = claim(original, "job-1", "token-A");
  const second = claim(first.job, "job-1", "token-B");

  assertEquals(first.claimed, true);
  assertEquals(second.claimed, false);
  assertEquals(second.job.leaseToken, "token-A");
});
    
