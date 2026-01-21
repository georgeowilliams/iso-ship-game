import { describe, it, expect } from "vitest";
import { VoteCollector, VOTE_CHOICES } from "../src/core/voteCollector.js";

describe("voteCollector", () => {
  it("latest vote overrides per user", () => {
    const collector = new VoteCollector();
    collector.addVote({ userId: "a", choice: "F" });
    collector.addVote({ userId: "a", choice: "L" });
    collector.addVote({ userId: "b", choice: "L" });
    const tally = collector.tally();
    expect(tally.F).toBe(0);
    expect(tally.L).toBe(2);
  });

  it("weights apply correctly", () => {
    const collector = new VoteCollector();
    collector.addVote({ userId: "a", choice: "R", weight: 2 });
    collector.addVote({ userId: "b", choice: "R" });
    collector.addVote({ userId: "c", choice: "F" });
    const tally = collector.tally();
    expect(tally.R).toBe(3);
    expect(tally.F).toBe(1);
  });

  it("deterministic tie-breaking follows priority order", () => {
    const collector = new VoteCollector();
    collector.addVote({ userId: "a", choice: "F" });
    collector.addVote({ userId: "b", choice: "L" });
    expect(collector.resolveWinner()).toBe(VOTE_CHOICES[0]);
  });
});
