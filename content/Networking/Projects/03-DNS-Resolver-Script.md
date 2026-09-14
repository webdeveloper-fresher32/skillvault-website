# Project 3 — DNS Resolver Script

**Level:** Intermediate
**Time estimate:** 45 – 75 minutes
**Phase prerequisite:** Phase 04 – DNS Deep Dive

---

## Overview

This project has two parts. First, you'll use Python's built-in, OS-backed resolver functions (`socket.gethostbyname`, `socket.getaddrinfo`) to resolve domain names the "normal" way — the way virtually every application does it. Second, and more instructively, you'll bypass the OS resolver entirely and hand-build a raw DNS query packet per RFC 1035, send it over UDP directly to a public resolver (`8.8.8.8:53`), and manually parse the binary response — no `dnspython`, no `socket.getaddrinfo`. This turns Phase 04's discussion of the DNS message format (header, question section, resource records) into something you've assembled byte-by-byte.

---

## Requirements

- Python 3.8+ (stdlib only — `socket`, `struct`)
- Outbound UDP access on port 53 (works on most home/office networks; some corporate networks block raw UDP:53 to external resolvers — if so, run this from a personal network)

---

## Project Structure

```
03-dns-resolver/
└── dns_resolver.py
```

---

## Full Code — `dns_resolver.py`

```python
"""
DNS resolver script — two approaches:

1. OS-backed resolution using socket.gethostbyname() / socket.getaddrinfo()
   (what applications normally do — delegates to libc's resolver, which
   reads /etc/resolv.conf, may hit a local cache, etc.)

2. A raw DNS query built by hand per RFC 1035 and sent over UDP directly
   to a public resolver (8.8.8.8), with the response parsed by hand.
   This is what gethostbyname() is doing under the hood, made visible.
"""

import socket
import struct
import random
import sys

# ---------------------------------------------------------------------------
# Part 1 — OS-backed resolution
# ---------------------------------------------------------------------------

def resolve_with_os(domain: str):
    print(f"\n--- OS-backed resolution for {domain} ---")

    try:
        ip = socket.gethostbyname(domain)
        print(f"gethostbyname(): {domain} -> {ip}")
    except socket.gaierror as e:
        print(f"gethostbyname() failed: {e}")

    try:
        # getaddrinfo returns ALL addresses (IPv4 + IPv6) plus socket params.
        # Each result tuple: (family, socktype, proto, canonname, sockaddr)
        results = socket.getaddrinfo(domain, None)
        seen = set()
        print("getaddrinfo() results:")
        for family, socktype, proto, canonname, sockaddr in results:
            ip_addr = sockaddr[0]
            family_name = "IPv4" if family == socket.AF_INET else "IPv6"
            key = (family_name, ip_addr)
            if key not in seen:
                seen.add(key)
                print(f"  {family_name}: {ip_addr}")
    except socket.gaierror as e:
        print(f"getaddrinfo() failed: {e}")


# ---------------------------------------------------------------------------
# Part 2 — Raw DNS query over UDP, built per RFC 1035
# ---------------------------------------------------------------------------

DNS_SERVER = "8.8.8.8"
DNS_PORT = 53
TYPE_A = 1
CLASS_IN = 1


def build_dns_query(domain: str, query_id: int) -> bytes:
    """
    Build a minimal RFC 1035 DNS query packet for an A record lookup.

    Packet layout:
      Header (12 bytes):
        ID (2) | Flags (2) | QDCOUNT (2) | ANCOUNT (2) | NSCOUNT (2) | ARCOUNT (2)
      Question section:
        QNAME (variable, length-prefixed labels, terminated by 0x00)
        QTYPE (2)
        QCLASS (2)
    """
    # --- Header ---
    flags = 0x0100  # QR=0 (query), Opcode=0 (standard query), RD=1 (recursion desired)
    qdcount = 1
    ancount = 0
    nscount = 0
    arcount = 0
    header = struct.pack(
        ">HHHHHH", query_id, flags, qdcount, ancount, nscount, arcount
    )

    # --- Question: QNAME ---
    # "www.example.com" -> b"\x03www\x07example\x03com\x00"
    qname = b""
    for label in domain.split("."):
        qname += struct.pack("B", len(label)) + label.encode("ascii")
    qname += b"\x00"  # root label terminator

    qtype = struct.pack(">H", TYPE_A)
    qclass = struct.pack(">H", CLASS_IN)

    return header + qname + qtype + qclass


def parse_name(data: bytes, offset: int):
    """
    Parse a (possibly compressed) DNS name starting at `offset` in `data`.
    DNS uses a compression scheme: a byte with its top two bits set
    (0xC0 mask) is a POINTER to an earlier offset in the packet, not a
    length byte. Returns (name_string, offset_after_name).
    """
    labels = []
    original_offset = None  # remember where to resume if we follow a pointer
    jumped = False

    while True:
        length = data[offset]

        if length == 0:
            offset += 1
            break

        if (length & 0xC0) == 0xC0:  # compression pointer
            if not jumped:
                original_offset = offset + 2
            pointer = ((length & 0x3F) << 8) | data[offset + 1]
            offset = pointer
            jumped = True
            continue

        offset += 1
        labels.append(data[offset:offset + length].decode("ascii"))
        offset += length

    final_offset = original_offset if jumped else offset
    return ".".join(labels), final_offset


def parse_dns_response(data: bytes):
    """Parse the header + answer section of a DNS response, extracting A records."""
    header = data[:12]
    query_id, flags, qdcount, ancount, nscount, arcount = struct.unpack(">HHHHHH", header)

    rcode = flags & 0x000F
    if rcode != 0:
        rcode_names = {1: "FORMERR", 2: "SERVFAIL", 3: "NXDOMAIN", 5: "REFUSED"}
        print(f"DNS server returned error code {rcode} ({rcode_names.get(rcode, 'UNKNOWN')})")
        return []

    offset = 12

    # Skip the question section (QNAME + QTYPE(2) + QCLASS(2))
    for _ in range(qdcount):
        _, offset = parse_name(data, offset)
        offset += 4

    ips = []
    for _ in range(ancount):
        _, offset = parse_name(data, offset)  # NAME
        rtype, rclass, ttl, rdlength = struct.unpack(">HHIH", data[offset:offset + 10])
        offset += 10
        rdata = data[offset:offset + rdlength]
        offset += rdlength

        if rtype == TYPE_A and rdlength == 4:
            ip = ".".join(str(b) for b in rdata)
            ips.append((ip, ttl))
        # (other record types like CNAME/AAAA are skipped in this minimal parser)

    return ips


def resolve_raw_udp(domain: str):
    print(f"\n--- Raw UDP DNS query for {domain} (via {DNS_SERVER}:{DNS_PORT}) ---")

    query_id = random.randint(0, 0xFFFF)
    query = build_dns_query(domain, query_id)

    # SOCK_DGRAM = UDP: connectionless, no handshake, just send-and-wait
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(3.0)
    try:
        sock.sendto(query, (DNS_SERVER, DNS_PORT))
        response, _ = sock.recvfrom(512)  # 512 bytes = classic DNS UDP message limit
    except socket.timeout:
        print("Query timed out (UDP is unreliable — no retry logic in this demo)")
        return
    finally:
        sock.close()

    resp_id = struct.unpack(">H", response[:2])[0]
    if resp_id != query_id:
        print("Warning: response ID does not match query ID, discarding (possible spoofing)")
        return

    records = parse_dns_response(response)
    if not records:
        print("No A records found")
    for ip, ttl in records:
        print(f"  A record: {domain} -> {ip}  (TTL={ttl}s)")


if __name__ == "__main__":
    domain = sys.argv[1] if len(sys.argv) > 1 else "example.com"
    resolve_with_os(domain)
    resolve_raw_udp(domain)
```

---

## How to Run

```bash
python3 dns_resolver.py example.com
```

Or resolve any other domain:

```bash
python3 dns_resolver.py google.com
```

---

## Sample Output

```
--- OS-backed resolution for example.com ---
gethostbyname(): example.com -> 93.184.216.34
getaddrinfo() results:
  IPv4: 93.184.216.34
  IPv6: 2606:2800:220:1:248:1893:25c8:1946

--- Raw UDP DNS query for example.com (via 8.8.8.8:53) ---
  A record: example.com -> 93.184.216.34  (TTL=21504s)
```

(Exact IPs/TTLs will vary by when and where you run this — DNS answers are cached and TTLs count down.)

---

## Design Notes

- **`gethostbyname()` vs `getaddrinfo()`**: `gethostbyname()` is legacy, IPv4-only, and deprecated in favor of `getaddrinfo()`, which is protocol-agnostic (handles IPv4 and IPv6) and is what modern code should use. Both ultimately go through the OS's resolver library (which itself talks to a recursive resolver configured in `/etc/resolv.conf` or the OS network settings) — this is the "stub resolver -> recursive resolver" hop described in Phase 04.
- **The raw UDP path re-implements exactly what a recursive resolver does on the wire** when it queries an authoritative or intermediate DNS server: build a 12-byte header (ID, flags, counts), encode the question name as length-prefixed labels, append QTYPE/QCLASS, and send it as a single UDP datagram. No handshake — UDP is connectionless (Phase 02), which is why DNS traditionally uses it: one packet out, one packet back, minimal overhead.
- **DNS name compression** (the `0xC0` pointer scheme in `parse_name`) exists because DNS responses often repeat the same domain name (once in the question, again in each answer record) — pointers avoid re-sending it. Any real parser must handle this or it will misread every response with more than one record.
- **The 512-byte `recvfrom` limit** reflects classic DNS-over-UDP behavior: historically DNS responses were capped at 512 bytes over UDP, with larger responses requiring TCP fallback (indicated by the truncation/`TC` flag) or, on modern resolvers, EDNS0 to negotiate larger UDP payloads. This demo does not implement TCP fallback.
- **The query-ID check guards against a simplified form of DNS cache-poisoning/spoofing** — production resolvers also randomize the source port and validate the question section echoed back, which this minimal script does not do.

---

## Possible Extensions

1. Add TCP fallback: if the `TC` (truncated) flag is set in the response flags, reissue the query over a TCP socket per RFC 1035.
2. Extend `parse_dns_response` to also handle `CNAME` (type 5), `AAAA` (type 28), and `MX` (type 15) records.
3. Add basic retry-with-timeout logic and try multiple resolvers (`8.8.8.8`, `1.1.1.1`) if one times out.
4. Measure and print resolution latency for the OS resolver vs. the raw UDP query to see caching effects.
5. Implement a tiny recursive resolver: start at a root server, follow referrals down through TLD and authoritative servers instead of asking `8.8.8.8` directly.
