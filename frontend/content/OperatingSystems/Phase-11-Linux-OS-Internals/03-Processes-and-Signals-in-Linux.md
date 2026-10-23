# Processes and Signals in Linux — Complete Guide

## Table of Contents
1. [The Process Hierarchy](#1-the-process-hierarchy)
2. [PID, PPID, and How Processes Are Born](#2-pid-ppid-and-how-processes-are-born)
3. [What Is a Signal?](#3-what-is-a-signal)
4. [Common Signals You Must Know](#4-common-signals-you-must-know)
5. [How Processes Handle Signals](#5-how-processes-handle-signals)
6. [Zombie Processes](#6-zombie-processes)
7. [Orphan Processes](#7-orphan-processes)
8. [Zombie vs Orphan — Side by Side](#8-zombie-vs-orphan--side-by-side)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. The Process Hierarchy

Every process on a Linux system, except PID 1, has exactly one parent. This forms a tree rooted at PID 1 (`systemd`/`init`).

```
systemd (PID 1)
├── systemd-journald (PID 512)
├── sshd (PID 890)
│      └── sshd: alice [priv] (PID 3001)
│              └── bash (PID 3002)              ← your login shell
│                      ├── node server.js (PID 3050)
│                      │       └── node worker (PID 3051)  (fork'd worker)
│                      └── vim notes.txt (PID 3060)
└── cron (PID 700)
       └── /usr/local/bin/backup.sh (PID 9001)
```

You can view this tree directly:
```bash
pstree -p          # Linux — visual tree with PIDs
ps -ef --forest    # Linux — indented tree view
ps -axjf           # BSD-style forest view (works on macOS too)
```

Every process, when it exits, reports an **exit status** to its parent. The parent is expected to "reap" it via `wait()`/`waitpid()`. This bookkeeping is the root cause of zombie processes (Section 6).

---

## 2. PID, PPID, and How Processes Are Born

- **PID** (Process ID) — a unique integer identifying a running process.
- **PPID** (Parent Process ID) — the PID of the process that created it.

Processes are created via `fork()` (duplicate the calling process) typically followed by `execve()` (replace the duplicate's memory image with a new program) — the classic "fork+exec" pattern:

```
Shell (bash, PID 3002) runs "node server.js":

  1. bash calls fork()
        │
        ├── PARENT: bash (PID 3002) continues, PPID stays whatever it was
        │
        └── CHILD: new process, PID 3050, PPID = 3002 (same code as bash, momentarily)
                        │
                        └── CHILD calls execve("/usr/bin/node", ["node","server.js"])
                                    → child's memory image is replaced with node's
                                    → PID stays 3050, PPID stays 3002
                                    → now it's really "node server.js" running
```

Key facts interviewers probe:
- `fork()` returns twice — once in the parent (returns the child's PID) and once in the child (returns `0`) — same code, different return value, is how each side knows which one it is.
- `execve()` does **not** create a new process — it replaces the current process's code/data with a new program, keeping the same PID.
- PID 1 (`systemd`/`init`) is the only process created directly by the kernel; every other process descends from it through fork chains.

---

## 3. What Is a Signal?

A **signal** is a limited, asynchronous notification sent to a process — a software interrupt. Signals tell a process "something happened" (user pressed Ctrl+C, another process wants you to shut down, a hardware exception occurred) without the sender needing to know what the receiving process is doing internally.

```
Sender                              Receiver (target process)
──────                              ──────────────────────────
kill -9 1234        ───signal───▶   process 1234
Ctrl+C in terminal   ───SIGINT──▶   foreground process
kernel (div by zero) ───SIGFPE──▶   the offending process
another process      ───SIGTERM─▶   any process it has permission to signal
```

Signals interrupt whatever the process is doing (subject to some rules) and, unless the process has installed a custom handler, trigger a **default action** — usually terminate, terminate+core-dump, stop, continue, or ignore.

---

## 4. Common Signals You Must Know

| Signal | Number | Default Action | Can Be Caught/Ignored? | Typical Use |
|---|---|---|---|---|
| `SIGHUP` | 1 | Terminate | Yes | Sent when a controlling terminal closes; daemons often catch it to mean "reload config" |
| `SIGINT` | 2 | Terminate | Yes | Sent by Ctrl+C in a terminal — "please stop" |
| `SIGKILL` | 9 | Terminate | **No — cannot be caught, blocked, or ignored** | Force-kill, last resort (`kill -9`) |
| `SIGTERM` | 15 | Terminate | Yes | The polite/default `kill` signal — "please shut down gracefully" |
| `SIGSTOP` | 19 | Stop process | **No — cannot be caught, blocked, or ignored** | Pause a process (like Ctrl+Z but unblockable) |
| `SIGTSTP` | 20 | Stop process | Yes | Sent by Ctrl+Z — "please pause" |
| `SIGCONT` | 18 | Continue if stopped | Yes | Resumes a stopped process |
| `SIGCHLD` | 17 | Ignore | Yes | Sent to a parent when a child terminates or stops — parents often use this to know when to `wait()` |
| `SIGSEGV` | 11 | Terminate + core dump | Yes | Invalid memory access ("segfault") |
| `SIGUSR1`/`SIGUSR2` | 10/12 | Terminate | Yes | User-defined — apps use these for custom signals (e.g. "reopen log file") |

**The critical distinction for interviews:** `SIGTERM` (15) is a *request* that a well-behaved process can intercept to clean up (close DB connections, flush buffers, delete temp files) before exiting. `SIGKILL` (9) is enforced directly by the kernel — it terminates the process immediately with zero opportunity for cleanup, because `SIGKILL` and `SIGSTOP` bypass the normal signal-delivery mechanism entirely.

---

## 5. How Processes Handle Signals

When a signal arrives, a process can do one of three things (for signals other than `SIGKILL`/`SIGSTOP`, which are fixed):

```
1. DEFAULT   — take the kernel's default action for that signal (usually terminate)
2. IGNORE    — explicitly tell the kernel to drop this signal (SIG_IGN)
3. CATCH     — install a custom "signal handler" function; when the signal
               arrives, the kernel interrupts the process's normal execution,
               runs the handler function, then (usually) resumes where it left off
```

Example: a Node.js server gracefully handling `SIGTERM` (this is application code, shown to illustrate the concept — not a syscall trace):
```js
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing server gracefully...');
  server.close(() => process.exit(0));
});
```
This is exactly why `kill <pid>` (which sends `SIGTERM` by default) is the "ask nicely" way to stop something, and `kill -9 <pid>` (`SIGKILL`) is the "no negotiation" way — used when a process is unresponsive or ignoring `SIGTERM`.

```bash
kill -l                # list all signal names and numbers
kill -TERM 1234        # same as: kill 1234 (SIGTERM is the default)
kill -9 1234           # SIGKILL — unconditional, immediate termination
kill -HUP 1234         # commonly used to tell daemons to reload config
```

---

## 6. Zombie Processes

A **zombie** (state `Z` in `ps`) is a process that has **finished executing** but whose exit status hasn't yet been collected by its parent via `wait()`/`waitpid()`.

```
1. Child process runs, then calls exit() (or returns from main)
2. Kernel frees almost all of the child's resources (memory, file descriptors)
   BUT keeps a small entry in the process table: PID, exit status, resource usage
3. Child is now a ZOMBIE — "dead" but still occupies a process table slot
4. Parent is expected to call wait()/waitpid() to read that exit status
5. Once the parent reaps it, the process table entry is finally removed
```

```
Parent (bash script)                    Child
─────────────────────                   ─────
fork() child ──────────────────────▶   runs, does work
                                         exit(0)
                                             │
                                             ▼
                                        [ZOMBIE — waiting to be reaped]
waitpid(child_pid, &status, 0)  ◀───── reads exit status
                                             │
                                             ▼
                                        [entry removed from process table]
```

A zombie is harmless in small numbers — it uses almost no resources, just a process table slot. But if a parent **never** calls `wait()` (a bug — e.g. a buggy process-spawning script that forks children repeatedly and never reaps them), zombies accumulate and can eventually exhaust the process table, preventing new processes from being created system-wide.

**Important:** you cannot `kill` a zombie — it's already dead; there's no running process left to signal. The only fix is to make the parent call `wait()` (fix the code), or if the parent itself is the problem, kill/restart the parent, at which point `init`/`systemd` inherits and reaps the zombie (see Section 7).

---

## 7. Orphan Processes

An **orphan** is a process whose **parent has died while the child is still running**. Orphans are not a problem — Linux immediately re-parents them to `init`/`systemd` (PID 1), whose job includes reaping any child (including inherited ones) when it eventually exits.

```
Before:                          Parent process dies
bash (PID 3002)                       │
  └── sleep 300 (PID 3099)            ▼
                                 After: orphan re-parented
systemd (PID 1)
  └── sleep 300 (PID 3099)     ← PPID is now 1, still running fine
```

```bash
# See this yourself:
sleep 300 &                 # start a background process
disown                      # detach it from the shell's job table (optional)
# close the terminal / kill the parent shell
# then in a new terminal:
ps -ef | grep sleep         # PPID will now show 1 (or your terminal-managing process)
```

Orphans are completely normal and expected — they keep running, and `init` guarantees they'll be properly reaped when they finish, so they never become permanent zombies.

---

## 8. Zombie vs Orphan — Side by Side

| Aspect | Zombie | Orphan |
|---|---|---|
| Process state | Already terminated (dead), just not reaped | Still alive and running |
| What's "wrong" | Parent hasn't called `wait()` yet | Parent died before child did |
| Is it harmful? | Only if they accumulate en masse (process table exhaustion) | No — completely normal, self-resolving |
| Resource usage | Minimal (just a process table entry) | Normal (still a fully running process) |
| Who fixes it | The parent must call `wait()`; or kill+restart the parent | Nothing needed — `init`/`systemd` auto-adopts and will reap it later |
| Can you `kill` it? | No — already dead, no process to signal | Yes — it's a normal, live process |
| `ps` state code | `Z` (zombie / defunct) | Normal state (`S`, `R`, etc.) but `PPID` = 1 |

---

## 9. Hands-On Exercises

**Exercise 1:** Run `pstree -p $$` (Linux) or `ps -axjf | grep -A2 $$` (macOS/BSD) — `$$` is your shell's own PID. Identify your shell's parent and any children it currently has.

**Exercise 2:** In one terminal, run `sleep 500 &` to background a process, note its PID with `jobs -l`, then find it with `ps -ef | grep sleep`. Confirm its PPID matches your shell's PID.

**Exercise 3:** Send it `SIGTERM` with `kill <pid>`, confirm (`ps -ef | grep sleep`) it's gone. Repeat with a process that ignores SIGTERM (harder to demo safely) to understand why `kill -9` exists as an escape hatch — read `kill -l` to see the full signal list on your machine.

**Exercise 4 (Linux):** Create a zombie deliberately: run `sleep 2 & ` then, before it finishes, in another terminal run `ps -el | grep sleep` a few times around the 2-second mark — the moment it exits but before your shell reaps it (which it does almost instantly for background jobs, so this is easier to observe by writing a tiny script that forks and never calls `wait`, or reading about it — the goal is to recognize the `Z` state code in `ps` output if you ever see it).

**Exercise 5:** Run `kill -l` and read through the full signal list on your system. Pick three signals not covered in this lesson (e.g. `SIGPIPE`, `SIGALRM`, `SIGBUS`) and look up (`man 7 signal` on Linux) what triggers them.

---

## 10. Interview Q&A

**Q: What is the difference between SIGTERM and SIGKILL?**
Answer: `SIGTERM` (15) is a polite termination request that a process can catch, ignore, or handle with cleanup logic (closing connections, flushing data) before exiting — it's the default signal sent by plain `kill <pid>`. `SIGKILL` (9) cannot be caught, blocked, or ignored — the kernel terminates the process immediately with no chance for cleanup. You use `SIGTERM` first and only escalate to `SIGKILL` (`kill -9`) if the process doesn't respond, because `-9` can leave resources (temp files, DB transactions, locks) in an inconsistent state.

**Q: What is a zombie process and how do you get rid of one?**
Answer: A zombie is a process that has finished executing but whose exit status hasn't been collected by its parent via `wait()`. It's already dead — it holds only a small process-table entry, not real resources — so you cannot kill it (there's no running process to signal). The fix is for the parent to call `wait()`/`waitpid()`; if the parent is buggy and never will, you kill or restart the parent process, and `init`/`systemd` will then reap the zombie (or it will already be gone since the zombie's original parent is what needed fixing).

**Q: What is an orphan process, and is it dangerous?**
Answer: An orphan is a process whose parent died while it was still running. It is not dangerous — Linux immediately re-parents it to `init`/`systemd` (PID 1), which guarantees it will be properly reaped via `wait()` once the orphan eventually exits, so it never becomes a permanent zombie. Orphans are a completely normal and common occurrence (e.g. background jobs surviving a terminal closing).

**Q: How would you kill a hung process?**
Answer: First identify it with `ps aux | grep <name>` or `top`/`htop` to get its PID. Try a graceful shutdown first: `kill <pid>` (sends `SIGTERM`), giving the process a chance to clean up. If it's still running after a few seconds (check with `ps -p <pid>`), force it with `kill -9 <pid>` (`SIGKILL`), which the kernel enforces unconditionally. For a process bound to a port, you can also target it directly, e.g. `kill -9 $(lsof -t -i:8080)`.

**Q: Explain `fork()` and `exec()` and how they relate to process creation.**
Answer: `fork()` creates a new process by duplicating the calling process — it returns twice, once in the parent (with the child's PID) and once in the child (with `0`), so the same code can tell which side it's running on. `exec()` (e.g. `execve()`) then replaces that child's memory image with a completely different program while keeping the same PID. The combination — fork then exec — is the standard Unix way to launch a new program from an existing one, and it's literally what your shell does every time you type a command.

**Q: What does PPID mean and what happens to it when a parent process exits?**
Answer: PPID is the Parent Process ID — the PID of whichever process created the current one via fork. If a parent exits while its child is still running, the child becomes an orphan and the kernel updates its PPID to point to `init`/`systemd` (PID 1), which adopts it so it can be properly reaped later. You can observe this by backgrounding a process, closing its parent shell, and then checking `ps -ef` for that process — its PPID will now show `1`.
