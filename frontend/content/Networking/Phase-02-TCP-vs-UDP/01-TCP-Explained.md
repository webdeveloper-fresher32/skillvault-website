# TCP Explained — Complete Guide

## Table of Contents
1. [What is TCP?](#1-what-is-tcp)
2. [Connection-Oriented, Reliable, Ordered](#2-connection-oriented-reliable-ordered)
3. [The 3-Way Handshake](#3-the-3-way-handshake)
4. [Flow Control](#4-flow-control)
5. [Congestion Control (Briefly)](#5-congestion-control-briefly)
6. [The 4-Way Termination](#6-the-4-way-termination)
7. [Hands-On Exercises](#7-hands-on-exercises)
8. [Interview Q&A](#8-interview-qa)

---

## 1. What is TCP?

TCP (Transmission Control Protocol) is a **transport-layer protocol** that provides reliable, ordered, connection-oriented delivery of a stream of bytes between two applications. It sits directly below application protocols like HTTP, HTTPS, and most APIs you build.

```
Application:  HTTP, HTTPS, gRPC, FTP, SSH, database drivers
                        │
Transport:            TCP    ◄── this lesson
                        │
Network:               IP
```

Think of TCP as a phone call: you dial, the other side picks up, you both agree the line is open, you talk in order, and you both hang up explicitly when done. Compare that to UDP (next lesson), which is more like dropping postcards in a mailbox — no confirmation anyone received them, no guaranteed order.

---

## 2. Connection-Oriented, Reliable, Ordered

TCP makes three core promises to the application using it:

### Connection-Oriented

Before any data flows, both sides perform a handshake to establish a shared "connection" — an agreed-upon starting point (sequence numbers) and confirmation that both ends are alive and listening.

### Reliable Delivery

Every byte sent is tracked with a sequence number. The receiver sends **acknowledgments (ACKs)** back. If the sender doesn't get an ACK within a timeout, it **retransmits** the data — nothing is silently lost.

```
Sender                          Receiver
  │── Segment (seq=1000) ─────────▶│
  │                                │  (received, buffered)
  │◀──────────── ACK (ack=1500) ───│
  │  (no ACK received in time?)    │
  │── Retransmit segment ─────────▶│
```

### Ordered Delivery

Segments can arrive out of order over the network (different routing paths, retransmissions). TCP uses sequence numbers to **reassemble them in the correct order** before handing the byte stream to the application — the app never sees out-of-order data.

```
Sent:      [1][2][3][4]
Arrives:   [1][3][2][4]   ← network reordered them
Delivered to app:  [1][2][3][4]   ← TCP reorders before delivery
```

These three guarantees are exactly why TCP is heavier than UDP — the bookkeeping (sequence numbers, ACKs, buffers, timers, retransmission logic) has a real cost in latency and overhead.

---

## 3. The 3-Way Handshake

Before data can flow, TCP establishes a connection using three segments. This is often drawn as **SYN, SYN-ACK, ACK**.

```
   Client                                   Server
     │                                         │
     │──────────── SYN (seq=x) ───────────────▶│   "I want to connect.
     │                                         │    My starting sequence is x."
     │                                         │
     │◀─────── SYN-ACK (seq=y, ack=x+1) ───────│   "OK, I acknowledge x.
     │                                         │    My starting sequence is y."
     │                                         │
     │──────────── ACK (ack=y+1) ─────────────▶│   "Acknowledged. Connection open."
     │                                         │
     │◀════════ connection established ═══════▶│
     │                                         │
     │──────────── data flows both ways ──────▶│
```

Step by step:

1. **SYN** — Client picks a random initial sequence number `x` and sends a segment with the `SYN` flag set. This says "I'd like to open a connection, and my byte stream starts at sequence `x`."
2. **SYN-ACK** — Server responds with its own random initial sequence number `y`, sets both the `SYN` and `ACK` flags, and acknowledges the client's sequence number with `ack = x + 1`. This says "I acknowledge your sequence, and my byte stream starts at `y`."
3. **ACK** — Client acknowledges the server's sequence number with `ack = y + 1`. The connection is now considered **ESTABLISHED** on both sides, and application data can flow.

### Why 3 steps and not 2?

Both sides need to prove they can **send and receive**. A 2-way handshake would only confirm the client can reach the server — not that the server's reply actually reaches the client. The third ACK confirms the full round trip works before any real data is risked.

### TCP Connection States (simplified)

```
Client: CLOSED → SYN_SENT → ESTABLISHED
Server: LISTEN → SYN_RECEIVED → ESTABLISHED
```

---

## 4. Flow Control

Flow control prevents a fast sender from overwhelming a slow receiver's buffer.

Each side advertises a **receive window (rwnd)** in every ACK — how many more bytes it's currently willing to buffer. The sender must not have more than `rwnd` bytes of unacknowledged data in flight at once.

```
Receiver's buffer is filling up:
  ACK: "I can accept 500 more bytes right now" (rwnd=500)
  Sender:  sends at most 500 bytes, then waits for more window

Receiver's buffer is empty again:
  ACK: "I can accept 64000 more bytes" (rwnd=64000)
  Sender:  sends more freely
```

This is a purely **receiver-driven** mechanism — it protects the receiver, not the network.

---

## 5. Congestion Control (Briefly)

Congestion control is the sender's mechanism to avoid overwhelming the **network** (routers, links) between it and the receiver — separate from flow control, which protects the receiver's buffer.

TCP maintains a **congestion window (cwnd)** and grows it cautiously:

- **Slow start** — cwnd starts small and doubles each round trip until a threshold or packet loss.
- **Congestion avoidance** — after the threshold, cwnd grows more slowly (roughly linearly).
- **On packet loss** — TCP assumes the network is congested, shrinks cwnd sharply, and starts growing cautiously again.

```
cwnd
 │                     packet loss detected
 │              ╱╲              │
 │           ╱╱    ╲            ▼
 │        ╱╱         ╲___   ╱ (cwnd cut, slow start again)
 │     ╱╱                 ╲╱
 │  ╱╱   slow start   congestion avoidance
 └──────────────────────────────────────▶ time
```

The actual amount of data in flight is `min(rwnd, cwnd)` — whichever is smaller wins. You don't need the full math for most interviews, but you should be able to say: *flow control protects the receiver, congestion control protects the network, and TCP throttles itself in response to packet loss.*

---

## 6. The 4-Way Termination

Closing a TCP connection takes four steps because TCP connections are **full-duplex** (each side has its own independent stream) and each direction must be closed separately.

```
   Client                                   Server
     │                                         │
     │──────────── FIN (seq=m) ───────────────▶│   "I'm done sending."
     │                                         │
     │◀──────────── ACK (ack=m+1) ─────────────│   "Acknowledged."
     │                                         │   (server may still be sending data)
     │                                         │
     │◀──────────── FIN (seq=n) ───────────────│   "I'm done sending too."
     │                                         │
     │──────────── ACK (ack=n+1) ─────────────▶│   "Acknowledged. Fully closed."
     │                                         │
     │  (client waits in TIME_WAIT briefly     │
     │   in case the last ACK was lost)        │
```

Step by step:

1. Client sends **FIN** — "I have no more data to send."
2. Server responds with **ACK** — acknowledges the client's FIN. The server may still have data left to send, so the connection isn't fully closed yet (this is a "half-close").
3. When the server is also done, it sends its own **FIN** — "I have no more data to send either."
4. Client responds with **ACK** — acknowledges the server's FIN. The connection is now fully closed.

The client that initiates closure enters a **TIME_WAIT** state for a short period afterward, just in case its final ACK was lost and the server retransmits its FIN.

---

## 7. Hands-On Exercises

**Exercise 1:** Run `python3 -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.connect(('example.com', 80)); print('connected')"` and watch it succeed — this triggers a real 3-way handshake to a public web server.

**Exercise 2:** On macOS/Linux, run `tcpdump -i any port 80 and host example.com` (may need `sudo`) in one terminal, then repeat Exercise 1 in another terminal. Identify the `[S]` (SYN), `[S.]` (SYN-ACK), and `[.]` (ACK) packets in the output.

**Exercise 3:** Run `netstat -an | grep ESTABLISHED` (or `ss -t` on Linux) while a browser tab is open to any website. Identify the local and remote IP:port pairs for at least one TCP connection.

**Exercise 4:** Open a terminal and run `nc -l 5000` (netcat listening on port 5000). In another terminal run `nc localhost 5000`, type a message, and confirm it appears in the first terminal — this is a live TCP connection you created manually.

**Exercise 5:** Close the connection from Exercise 4 with Ctrl+C on the client side, then run `tcpdump -i lo port 5000` before repeating the test to try to observe the FIN/ACK exchange during termination.

---

## 8. Interview Q&A

**Q: Walk me through the TCP 3-way handshake.**
Answer: Client sends a SYN with an initial sequence number. Server replies with SYN-ACK, acknowledging the client's sequence number and providing its own initial sequence number. Client replies with ACK, acknowledging the server's sequence number. After this, the connection is ESTABLISHED and both sides can exchange data.

**Q: Why does the handshake need three steps instead of two?**
Answer: A 2-way handshake only proves the client can reach the server. The third ACK proves the reverse direction also works — that the server's SYN-ACK actually reached the client — confirming a working full-duplex path before data is exchanged.

**Q: Why does TCP connection termination need four steps instead of two?**
Answer: TCP connections are full-duplex — data can flow independently in both directions. Each direction must be closed separately with its own FIN/ACK pair, since one side may still have data to send after the other side is done. That's why it's FIN→ACK (close direction 1), then FIN→ACK (close direction 2), rather than a single combined step.

**Q: What is the difference between flow control and congestion control?**
Answer: Flow control is receiver-driven and protects the receiver's buffer from being overwhelmed — controlled via the advertised receive window (rwnd). Congestion control is sender-driven and protects the shared network from being overwhelmed — controlled via the congestion window (cwnd), which grows cautiously (slow start) and shrinks sharply on detected packet loss.

**Q: What is the TIME_WAIT state and why does it exist?**
Answer: TIME_WAIT is a state the connection-closing side enters after sending the final ACK, lasting roughly 2x the maximum segment lifetime. It exists so that if that final ACK is lost and the other side retransmits its FIN, the closing side is still around to resend the ACK — preventing the peer from getting stuck.

**Q: How does TCP guarantee ordered delivery if IP packets can arrive out of order?**
Answer: Every byte in the stream is numbered with a sequence number. The receiver buffers incoming segments and uses these sequence numbers to reassemble the original byte order before handing data to the application, regardless of the order segments physically arrived in.

**Q: What happens if an ACK is never received by the sender?**
Answer: The sender starts a retransmission timer when it sends data. If no ACK arrives before the timer expires, the sender assumes the segment was lost (or its ACK was lost) and retransmits the data. This retry-with-timeout mechanism is the core of TCP's reliability guarantee.
