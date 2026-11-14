const status = document.querySelector("#connection-status");
const code = document.querySelector("#pairing-code");
const port = document.querySelector("#host-port");
const addresses = document.querySelector("#host-addresses");
const qr = document.querySelector("#pairing-qr");

window.mrkConnect.getHostInfo().then((info) => {
  code.textContent = info.pairingCode;
  port.textContent = String(info.port);
  addresses.textContent = info.addresses.length ? info.addresses.join("  ·  ") : "No local IPv4 address found";
  if (info.qrDataUrl) { qr.src = info.qrDataUrl; qr.hidden = false; }
  status.textContent = "Waiting for Android";
}).catch(() => {
  status.textContent = "Local connection host could not start";
});

window.mrkConnect.onHostStatus((value) => {
  status.textContent = value === "connected" ? "Android paired" : "Waiting for Android";
});
