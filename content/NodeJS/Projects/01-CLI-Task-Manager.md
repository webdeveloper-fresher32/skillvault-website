# Project 1 — CLI Task Manager

**Level:** Beginner
**Time estimate:** 30 – 45 minutes
**Phase prerequisite:** Phase 3 – Core Modules

---

## Requirements

Build a command-line task manager that runs entirely on Node.js core modules — no Express, no npm dependencies. Tasks persist to a JSON file on disk so they survive between runs. You will practice:

- Reading process arguments (`process.argv`)
- Synchronous and asynchronous file I/O with the `fs` module
- Working with JSON as a lightweight data store
- Structuring a small CLI tool without any framework

The tool supports four commands:

```
node index.js add "Buy groceries"
node index.js list
node index.js done 2
node index.js remove 2
```

---

## Project Structure

```
01-cli-task-manager/
├── package.json
├── index.js
├── tasks.js
└── tasks.json        (created automatically on first run)
```

---

## Code

### `package.json`

```json
{
  "name": "cli-task-manager",
  "version": "1.0.0",
  "description": "A simple file-backed CLI task manager built with core Node.js modules",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js"
  },
  "license": "MIT"
}
```

### `tasks.js`

```javascript
// tasks.js — handles all reading/writing of the tasks.json data file
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'tasks.json');

// Ensure the data file exists before we try to read it
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Load all tasks from disk
function loadTasks() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('tasks.json is corrupted — resetting to an empty list.');
    return [];
  }
}

// Persist the full task list back to disk
function saveTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

// Add a new task with an auto-incrementing id
function addTask(description) {
  const tasks = loadTasks();
  const nextId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
  const task = {
    id: nextId,
    description,
    done: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

// Mark a task as done by id
function completeTask(id) {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  task.done = true;
  task.completedAt = new Date().toISOString();
  saveTasks(tasks);
  return task;
}

// Remove a task by id
function removeTask(id) {
  const tasks = loadTasks();
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  saveTasks(tasks);
  return true;
}

module.exports = { loadTasks, addTask, completeTask, removeTask };
```

### `index.js`

```javascript
#!/usr/bin/env node
// index.js — CLI entry point: parses argv and dispatches to tasks.js
const { loadTasks, addTask, completeTask, removeTask } = require('./tasks');

const HELP_TEXT = `
CLI Task Manager

Usage:
  node index.js add "<description>"   Add a new task
  node index.js list                  List all tasks
  node index.js done <id>             Mark a task as done
  node index.js remove <id>           Delete a task
  node index.js help                  Show this help message
`;

function printTasks(tasks) {
  if (tasks.length === 0) {
    console.log('No tasks yet. Add one with: node index.js add "Task description"');
    return;
  }
  tasks.forEach((t) => {
    const box = t.done ? '[x]' : '[ ]';
    console.log(`${box} #${t.id}  ${t.description}`);
  });
}

function main() {
  // process.argv: [0] = node binary path, [1] = script path, [2..] = user args
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'add': {
      const description = args.join(' ').trim();
      if (!description) {
        console.error('Error: please provide a task description.');
        console.log('Example: node index.js add "Buy groceries"');
        process.exit(1);
      }
      const task = addTask(description);
      console.log(`Added task #${task.id}: "${task.description}"`);
      break;
    }

    case 'list': {
      const tasks = loadTasks();
      printTasks(tasks);
      break;
    }

    case 'done': {
      const id = parseInt(args[0], 10);
      if (Number.isNaN(id)) {
        console.error('Error: please provide a valid task id.');
        process.exit(1);
      }
      const task = completeTask(id);
      if (!task) {
        console.error(`Error: no task found with id ${id}.`);
        process.exit(1);
      }
      console.log(`Marked task #${task.id} as done.`);
      break;
    }

    case 'remove': {
      const id = parseInt(args[0], 10);
      if (Number.isNaN(id)) {
        console.error('Error: please provide a valid task id.');
        process.exit(1);
      }
      const removed = removeTask(id);
      if (!removed) {
        console.error(`Error: no task found with id ${id}.`);
        process.exit(1);
      }
      console.log(`Removed task #${id}.`);
      break;
    }

    case 'help':
    case undefined:
      console.log(HELP_TEXT);
      break;

    default:
      console.error(`Unknown command: "${command}"`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

main();
```

---

## How to Run

```bash
mkdir 01-cli-task-manager && cd 01-cli-task-manager
# create package.json, tasks.js, index.js with the contents above

node index.js add "Write project README"
node index.js add "Review pull request"
node index.js list
node index.js done 1
node index.js list
node index.js remove 2
node index.js list
```

Expected output after the two `add` calls and one `list`:

```
[ ] #1  Write project README
[ ] #2  Review pull request
```

After `done 1` and `remove 2`, `list` shows:

```
[x] #1  Write project README
```

---

## Design Notes

- **Synchronous fs calls are intentional here.** For a short-lived CLI process that reads/writes a small file and then exits, `readFileSync`/`writeFileSync` are simpler and avoid callback/promise plumbing for no real performance cost. In a long-running server you would use the async `fs.promises` API instead — see Phase 3 for the distinction.
- **The data file doubles as the entire "database."** Every command loads the full JSON array, mutates it in memory, and writes it back. This is fine at small scale but does not handle concurrent writers — two processes running `add` at the same instant could race and overwrite each other's data.
- **IDs are computed from `Math.max` of existing ids**, not array length, so IDs remain stable and non-reused even after a task in the middle is removed.
- **Exit codes matter for a CLI.** Error paths call `process.exit(1)` so shell scripts invoking this tool can detect failure (`if ! node index.js done 99; then ...`).

---

## Possible Extensions

1. **Priority levels** — add a `--priority=high|medium|low` flag and sort `list` output by priority.
2. **Due dates** — accept a `--due=YYYY-MM-DD` flag and highlight overdue tasks in the `list` output.
3. **Search/filter** — `node index.js list --done` or `list --pending` to filter by status.
4. **Colorized output** — use ANSI escape codes (or the `chalk` package) to color done vs. pending tasks.
5. **Atomic writes** — write to a temp file and `fs.renameSync` over `tasks.json` to avoid corruption if the process is killed mid-write.
