export function createWsClient({ onState, onStatus }) {
  let ws = null;
  let reconnectTimer = null;
  let closed = false;

  const notifyStatus = (status) => {
    if (onStatus) onStatus(status);
  };

  const connect = () => {
    if (closed) return;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.addEventListener("open", () => {
      notifyStatus("connected");
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "state") {
          onState?.(message.payload);
        }
      } catch (error) {
        console.error("WS message error", error);
      }
    });

    ws.addEventListener("close", () => {
      notifyStatus("disconnected");
      if (!closed) {
        reconnectTimer = setTimeout(connect, 1000);
      }
    });

    ws.addEventListener("error", () => {
      notifyStatus("error");
    });
  };

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    },
  };
}
