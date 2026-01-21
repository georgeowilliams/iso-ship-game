export function createKeyboardAdapter({ userId = "local" } = {}) {
  let handler = null;

  return {
    start(onVote) {
      if (handler) return;
      handler = (e) => {
        const k = e.key.toLowerCase();

        // no backward anymore
        const prevent = ["arrowup", "arrowleft", "arrowright", " ", "w", "a", "d"];
        if (prevent.includes(k)) e.preventDefault();

        if (k === "w" || k === "arrowup") {
          onVote({ userId, choice: "F" });
        }
        if (k === "a" || k === "arrowleft") {
          onVote({ userId, choice: "L" });
        }
        if (k === "d" || k === "arrowright") {
          onVote({ userId, choice: "R" });
        }
        if (k === " ") {
          onVote({ userId, choice: "SHOOT" });
        }
      };
      window.addEventListener("keydown", handler);
    },
    stop() {
      if (!handler) return;
      window.removeEventListener("keydown", handler);
      handler = null;
    },
  };
}
