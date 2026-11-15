# Shared protocol

Versioned JSON message contracts used by Windows and Android live here. Keep message names, required fields, validation rules and compatibility notes synchronized across both clients.


## Windows LAN discovery (UDP)

- Windows listens on UDP port **47832**.
- Android sends the UTF-8 datagram `MRKDISCOVER_V1` to the local subnet broadcast address.
- The PC replies directly to the sender with JSON:
  `{"type":"mrkConnectHost","version":1,"port":47831,"addresses":["192.168.x.x"]}`
- Discovery intentionally does **not** include the pairing PIN or session token. The user still scans the QR code or enters the six-digit PIN shown on Windows.
- Discovery is a convenience, not authentication. Pairing and session authorization remain mandatory.
