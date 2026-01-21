export function installKeyboard({ onAction }) {
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();

    // no backward anymore
    const prevent = ["arrowup", "arrowleft", "arrowright", " ", "w", "a", "d"];
    if (prevent.includes(k)) e.preventDefault();

    if (k === "w" || k === "arrowup") {
      onAction({ type: "move", move: "F", label: "MOVE: FORWARD" });
    }
    if (k === "a" || k === "arrowleft") {
      onAction({ type: "move", move: "L", label: "MOVE: FORWARD+LEFT" });
    }
    if (k === "d" || k === "arrowright") {
      onAction({ type: "move", move: "R", label: "MOVE: FORWARD+RIGHT" });
    }
    if (k === " ") {
      onAction({ type: "shoot", label: "SHOOT (PORT+STARBOARD)" });
    }
  });
}
