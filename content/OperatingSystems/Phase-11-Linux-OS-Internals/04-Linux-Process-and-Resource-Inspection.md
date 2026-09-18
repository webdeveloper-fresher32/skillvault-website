# Linux Process and Resource Inspection — The Operational Troubleshooting Playbook

## Table of Contents
1. [Why This Lesson Is Different](#1-why-this-lesson-is-different)
2. [The Symptom → Command Playbook](#2-the-symptom--command-playbook)
3. [Finding What's Using a Port](#3-finding-whats-using-a-port)
4. [Finding and Killing a Runaway Process](#4-finding-and-killing-a-runaway-process)
5. [Viewing Logs](#5-viewing-logs)
6. [Checking Memory and Disk Usage](#6-checking-memory-and-disk-usage)
7. [Putting It Together: A Worked Scenario](#7-putting-it-together-a-worked-scenario)
8. [Hands-On Exercises](#8-hands-on-exercises)
9. [Interview Q&A](#9-interview-qa)

---

## 1. Why This Lesson Is Different

Lessons 01–03 gave you the mental model — boot, kernel/syscalls, processes/signals. This lesson is the muscle memory: when something is broken in production at 2am, which command do you reach for first? This is asked constantly in interviews as scenario questions ("the app is unresponsive, walk me through what you'd check") because it reveals whether you've actually operated a Linux box, not just read about one.

> For deeper Bash scripting around these commands (piping, parsing output with `awk`/`grep`, writing monitoring scripts), see **[ShellScripting Phase 08: Text Processing](../ShellScripting/Phase-08-Text-Processing/)**. This lesson focuses on *which command answers which question*, not scripting them together.

---

## 2. The Symptom → Command Playbook

Keep this table in your head — it's the fastest way to sound operationally competent in an interview.

| Symptom | First command to run | What it tells you |
|---|---|---|
| "Is something already listening on port 8080?" | `lsof -i :8080` or `ss -ltnp \| grep 8080` | Which process (PID + name) owns that port |
| "The server won't start — port already in use" | `lsof -i :8080` | The PID of whatever is squatting on the port, so you can kill it |
| "A process is stuck / unresponsive" | `ps aux \| grep <name>` then `top`/`htop` | PID, CPU%, memory%, process state |
| "CPU is pegged at 100%" | `top` (sort by `%CPU`) | Which process(es) are consuming CPU |
| "The app is leaking memory" | `top`/`htop` sorted by `%MEM`, then `free -h` | Which process is growing, and overall system memory pressure |
| "I need to stop a hung process" | `kill <pid>` then `kill -9 <pid>` if needed | Graceful, then forceful termination |
| "The app crashed — why?" | `journalctl -u <service>` or check app log with `tail -f` | Recent log lines, error messages, stack traces |
| "Disk is full / can't write files" | `df -h` then `du -sh /path/* \| sort -h` | Which filesystem is full, then which directory is the culprit |
| "System feels slow overall" | `top` / `htop`, `free -h`, `df -h`, `uptime` (load average) | A fast triage across CPU, memory, disk, and load |
| "Is the machine even under load?" | `uptime` (load average) or `vmstat 1` | 1/5/15-minute load averages relative to CPU core count |

---

## 3. Finding What's Using a Port

This is one of the single most common real-world and interview questions: **"How would you find what's using port 8080?"**

```bash
# lsof — "list open files" (sockets count as files on Unix)
lsof -i :8080                  # anything bound to port 8080 (TCP or UDP)
lsof -i tcp:8080                # TCP only
lsof -i -P -n | grep LISTEN     # all listening sockets, numeric ports (no DNS lookups)

# ss — modern replacement for netstat, much faster
ss -ltnp                        # Listening, TCP, Numeric, show Process
ss -ltnp | grep 8080

# netstat — older tool, still widely available/known
netstat -tulpn | grep 8080      # TCP/UDP, Listening, Program name, Numeric
```

Example output (`lsof -i :8080`):
```
COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    12345  ganesh   22u  IPv6 123456      0t0  TCP *:8080 (LISTEN)
```
That `PID 12345` is exactly what you need to either investigate further (`ps -p 12345 -f`) or kill (`kill 12345`).

**macOS note:** `lsof -i :8080` works identically. `ss` is Linux-only; macOS uses `netstat` or `lsof`.

---

## 4. Finding and Killing a Runaway Process

**"How would you kill a hung process?"** — the full workflow, not just `kill -9`:

```bash
# STEP 1: Find it
ps aux | grep node              # search by name — shows PID, %CPU, %MEM, state
top                              # interactive, live, sorted by CPU by default
htop                             # nicer interactive UI (if installed) — sortable, killable from within

# STEP 2: Confirm it's actually the right one, and understand its state
ps -p 12345 -o pid,ppid,stat,etime,cmd
#   STAT column: R=running, S=sleeping, D=uninterruptible sleep (often disk I/O), Z=zombie, T=stopped

# STEP 3: Try graceful shutdown first — SIGTERM
kill 12345                       # sends SIGTERM by default — process can clean up

# STEP 4: Wait a moment, check if it's gone
ps -p 12345 || echo "process is gone"

# STEP 5: If it's still alive / unresponsive, force it — SIGKILL
kill -9 12345                    # unconditional, immediate, no cleanup possible

# One-liners combining find + kill:
kill -9 $(pgrep -f "node server.js")     # kill by matching command line
pkill -9 -f "node server.js"             # pkill = pgrep + kill combined
```

**Why try `SIGTERM` before `SIGKILL`?** A process mid-write to a database or file can leave corrupted state if killed with `SIGKILL`. `SIGTERM` gives well-behaved code the chance to close connections, flush buffers, and exit cleanly (see Lesson 03). Reach for `-9` only when `SIGTERM` is ignored or the process is truly stuck (e.g. in an unkillable `D` state waiting on unresponsive disk/NFS I/O, where even `SIGKILL` may not immediately work).

**`D` state gotcha (interview favorite):** A process in **uninterruptible sleep** (`D` in `ps`) is waiting on a kernel-level I/O operation (typically disk or network filesystem) and cannot be killed by *any* signal, including `SIGKILL`, until that I/O completes or times out. If you see many processes stuck in `D`, the disk/storage subsystem — not the application — is usually the real problem.

---

## 5. Viewing Logs

```bash
# journalctl — the systemd-native log viewer (Linux)
journalctl -u nginx              # logs for a specific systemd service/unit
journalctl -u nginx -f           # follow (live tail) that service's logs
journalctl -b                    # all logs since the current boot
journalctl --since "10 min ago"  # time-windowed
journalctl -p err                # filter to error-priority and above

# tail — universal, works on any plain-text log file (Linux/macOS)
tail -f /var/log/nginx/access.log      # follow a log file live
tail -n 100 /var/log/syslog             # last 100 lines
tail -f app.log | grep -i error         # follow + filter for errors live

# Combine with grep for a quick "what went wrong recently" check
journalctl -u myapp --since "1 hour ago" | grep -i -E "error|exception|fatal"
```

`journalctl` is the modern, structured, systemd-integrated way to read logs on most current distros (binary journal, indexed, filterable by unit/time/priority). `tail -f` is the universal fallback — it works on any application that writes plain-text log files, regardless of init system, and is the tool you'll use for app-specific logs that live outside the systemd journal (e.g. a Node.js app's own log file).

---

## 6. Checking Memory and Disk Usage

```bash
# Memory
free -h                          # -h = human-readable (GB/MB) — total/used/free/available RAM + swap
cat /proc/meminfo                # (Linux) raw, detailed memory stats
vmstat 1                         # live, refreshing every 1s — memory, swap, I/O, CPU in one view

# Disk usage — by filesystem
df -h                            # human-readable disk space per mounted filesystem
df -h /                          # just the root filesystem

# Disk usage — by directory (find what's eating space)
du -sh /var/log/*                # summarized size of each item in /var/log
du -sh /var/log/* | sort -rh | head -10   # top 10 largest — the classic "what's eating my disk" one-liner
```

Example `free -h` output:
```
              total        used        free      shared  buff/cache   available
Mem:           15Gi       4.2Gi       1.1Gi       200Mi        10Gi        10Gi
Swap:         2.0Gi          0B       2.0Gi
```
**Interview nuance:** "used" looks alarming but Linux aggressively uses free RAM for disk cache (`buff/cache`) since it's free performance — that memory is instantly reclaimable. The number that actually matters is **`available`**, which accounts for reclaimable cache — that's your true "how much can a new process actually get" figure.

`df` vs `du`: `df` reports space at the filesystem/mount level (how full is this disk partition); `du` reports space consumed by files/directories you point it at (which directory is the hog). You typically run `df -h` first to confirm a disk is full, then `du -sh /path/* | sort -rh` to find which subdirectory is responsible.

---

## 7. Putting It Together: A Worked Scenario

**Scenario:** "Users report the API is timing out. Walk me through your triage."

```bash
1. Is the process even running?
   ps aux | grep node
   systemctl status myapp          # if managed by systemd

2. Is it listening on the expected port?
   ss -ltnp | grep 3000
   lsof -i :3000

3. What does system load / resource pressure look like?
   top                              # CPU hogs? load average high relative to core count?
   free -h                          # memory pressure / swapping?
   df -h                            # disk full anywhere (can block writes/logging)?

4. What do the logs say right at the time of the incident?
   journalctl -u myapp --since "15 min ago"
   tail -n 200 /var/log/myapp/error.log

5. Based on findings:
   - Process crashed → check logs for the exception, restart: systemctl restart myapp
   - Process pegged at 100% CPU, unresponsive → kill gracefully, then -9 if needed,
     investigate root cause (infinite loop? runaway query?) before just restarting blindly
   - Disk full → clean up (du -sh to find the hog), free space, restart if the app
     needs disk to log/write and was blocked
   - Port conflict (another process grabbed 3000 first) → lsof -i :3000, kill the
     squatter or reconfigure
```

This is the shape interviewers want: **identify → confirm → diagnose → act**, using the right command at each step rather than guessing.

---

## 8. Hands-On Exercises

**Exercise 1:** Start a simple listener (`python3 -m http.server 8080` or `nc -l 8080` if available), then in another terminal find it with `lsof -i :8080` and separately with `ss -ltnp | grep 8080` (Linux) or `netstat -anv | grep 8080` (macOS). Confirm both point to the same PID.

**Exercise 2:** Kill the process you just started using its PID: first send `kill <pid>` and observe it stop; restart it, then this time use `pkill -f "http.server"` (or `pkill -f "nc -l"`) to kill it by matching the command line instead of the PID.

**Exercise 3:** Run `top` (or `htop` if installed), sort by memory (`M` in top, or click the header in htop), and identify the top 3 memory-consuming processes on your machine right now.

**Exercise 4:** Run `df -h` to see your disk usage per filesystem, then run `du -sh ~/Downloads/* 2>/dev/null | sort -rh | head -5` (or any directory you expect to be large) to find your biggest space consumers.

**Exercise 5 (Linux):** Run `journalctl -u ssh --since "1 hour ago"` (or any active service on your machine, `systemctl list-units --type=service` to find one) and read through real log entries. On macOS, use `log show --predicate 'process == "sshd"' --last 1h` as the closest equivalent, or `tail -f /var/log/system.log`.

---

## 9. Interview Q&A

**Q: How would you find what's using port 8080?**
Answer: `lsof -i :8080` shows any process with an open socket on that port, including its PID and process name. On Linux, `ss -ltnp | grep 8080` is the modern, fast equivalent (Listening, TCP, Numeric, Process). `netstat -tulpn | grep 8080` is the older but still common alternative. Once you have the PID, you can inspect it further with `ps -p <pid> -f` or terminate it with `kill`/`kill -9`.

**Q: How would you kill a hung process?**
Answer: First locate it — `ps aux | grep <name>` or `top`/`htop` — to get its PID and check its state. Send `SIGTERM` first (`kill <pid>`), which asks it to shut down gracefully and gives well-behaved code a chance to clean up. If it's still running after a few seconds, escalate to `SIGKILL` (`kill -9 <pid>`), which the kernel enforces unconditionally with no cleanup. Note that a process stuck in uninterruptible sleep (`D` state in `ps`, usually blocked on disk/NFS I/O) can't be killed by any signal, including `-9`, until the underlying I/O resolves.

**Q: What's the difference between `top` and `htop`, and when would you reach for each?**
Answer: `top` is preinstalled on virtually every Unix system and is the reliable default for a quick live view of CPU/memory usage per process. `htop` is a nicer, colorized, scrollable, mouse-friendly interface with easier sorting and even lets you send signals to a process directly from the UI — but it may not be installed by default, especially on minimal/production containers. In an interview or on an unfamiliar box, mention `top` as the guaranteed-available baseline.

**Q: How do you check disk usage and find what's filling up a disk?**
Answer: Start with `df -h` to see which mounted filesystem is actually full (space at the partition level). Then use `du -sh /path/* | sort -rh | head -10` on the relevant mount point to drill down and find which specific directory is consuming the most space — commonly log files, Docker images/layers, or old build artifacts. `df` answers "which disk is full"; `du` answers "which directory on that disk is the culprit."

**Q: `free -h` shows most of my RAM as "used" — is that a problem?**
Answer: Usually not. Linux aggressively uses otherwise-idle RAM for disk/page caching (shown as `buff/cache`), since that memory is instantly reclaimable if an application needs it. The meaningful number is the `available` column, which already accounts for reclaimable cache — that's the real answer to "how much memory can a new process actually get." High "used" with high "available" is healthy; the number to actually worry about is high swap usage or low `available`.

**Q: How would you check what's happening in a service's logs right now, live?**
Answer: For a systemd-managed service, `journalctl -u <service-name> -f` follows its logs live, structured and filterable by time/priority. For a plain application log file, `tail -f /path/to/app.log` follows it live, and can be piped through `grep` (e.g. `tail -f app.log | grep -i error`) to surface only relevant lines in real time.
