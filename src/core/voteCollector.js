export const VOTE_CHOICES = ["F", "L", "R", "SHOOT"];

export class VoteCollector {
  constructor({ priority = VOTE_CHOICES } = {}) {
    this.priority = [...priority];
    this.votes = new Map();
  }

  addVote({ userId, choice, weight = 1 }) {
    if (!userId || !this.priority.includes(choice)) return;
    if (weight <= 0) return;
    this.votes.set(userId, { choice, weight });
  }

  reset() {
    this.votes.clear();
  }

  tally() {
    const counts = Object.fromEntries(this.priority.map((c) => [c, 0]));
    for (const { choice, weight } of this.votes.values()) {
      counts[choice] += weight;
    }
    return counts;
  }

  resolveWinner() {
    const counts = this.tally();
    let best = null;
    let bestScore = 0;
    for (const choice of this.priority) {
      const score = counts[choice];
      if (score > bestScore) {
        best = choice;
        bestScore = score;
      }
    }
    return best;
  }
}
