const status = document.querySelector("#connection-status");
const code = document.querySelector("#pairing-code");
const port = document.querySelector("#host-port");

window.mrkConnect.getHostInfo().then((info) => {
  code.textContent = info.pairingCode;
  port.textContent = String(info.port);
  status.textContent = "Waiting for Android";
}).catch(() => {
  status.textContent = "Local connection host could not start";
});

window.mrkConnect.onHostStatus((value) => {
  status.textContent = value === "connected" ? "Android paired" : "Waiting for Android";
});
