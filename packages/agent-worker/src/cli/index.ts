#!/usr/bin/env bun
/**
 * aw — agent-worker CLI entry point.
 *
 * All commands route through AwClient (HTTP) except `daemon start` which starts the daemon directly.
 * Action commands (send, add, create, run, etc.) use ensureDaemon() to auto-start if needed.
 * Read-only commands (status, ls, info, etc.) use AwClient.discover() and fail fast if the daemon isn't running.
 */

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);

function printUsage() {
  console.log(`Usage: aw <command>

Daemon:
  daemon start [-p PORT]    Start daemon (foreground)
  daemon start -d           Start daemon (background)
  daemon stop               Stop daemon
  status                    Daemon, agents, and harnesss overview

Resources:
  add <name> [options]        Add standalone agent
  create <config.yaml>        Create harness (service mode)
  run <config.yaml>           Run harness as task (exits when done)
  ls                          List all agents + harnesss
  info <target>               Details about agent/harness
  rm <target>                 Remove agent or stop harness

Messaging:
  send <target> "message"     Send message(s)
  read <target> [N]           Read N messages from a stream
  repl <target>               Interactive chat (non-blocking send/receive)

Inspection:
  state <target>              Agent state, inbox, todos
  peek <target>               Read history from start
  log [<target>] [-f]         Event log (--follow for streaming)

Documents:
  doc ls [@harness]         List documents
  doc read <name>             Read document
  doc write <name> --content  Write document
  doc append <name> --content Append to document

Tasks:
  task ls [--status ...]           List tasks in the harness ledger
  task get <id>                    Show a task with its Wakes / handoffs / artifacts
  task new <title> --goal '...'    Create a new task (default status: draft)
  task update <id> --status open   Patch status / title / goal / owner / acceptance
  task dispatch <id> --to <worker> Hand a task to a worker
  task complete <id> [--summary]   Close active Wake + mark task completed
  task abort <id> [--reason]       Cancel active Wake + mark task aborted

Auth:
  auth <provider>             Save API key (anthropic, openai, google, deepseek, ...)
  auth status                 Show provider auth status
  auth rm <provider>          Remove a saved API key

Connections:
  connect telegram            Connect a Telegram bot (full setup flow)
  connect status              Show all configured connections
  connect rm <name>           Remove a saved connection

Target syntax: [agent][@harness[:tag]][#channel]
  alice, alice@review, @review:pr-42#design

The daemon is auto-started when needed. Use 'aw daemon start' for manual control.`);
}

async function main() {
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  switch (command) {
    case "daemon": {
      const { daemon } = await import("./commands/daemon.ts");
      return daemon(rest);
    }
    case "status": {
      const { status } = await import("./commands/status.ts");
      return status(rest);
    }
    case "add": {
      const { add } = await import("./commands/add.ts");
      return add(rest);
    }
    case "create": {
      const { create } = await import("./commands/create.ts");
      return create(rest);
    }
    case "run": {
      const { run } = await import("./commands/run.ts");
      return run(rest);
    }
    case "ls": {
      const { ls } = await import("./commands/ls.ts");
      return ls(rest);
    }
    case "info": {
      const { info } = await import("./commands/info.ts");
      return info(rest);
    }
    case "rm": {
      const { rm } = await import("./commands/rm.ts");
      return rm(rest);
    }
    case "send": {
      const { send } = await import("./commands/send.ts");
      return send(rest);
    }
    case "read": {
      const { read } = await import("./commands/read.ts");
      return read(rest);
    }
    case "state": {
      const { state } = await import("./commands/state.ts");
      return state(rest);
    }
    case "peek": {
      const { peek } = await import("./commands/peek.ts");
      return peek(rest);
    }
    case "log": {
      const { log } = await import("./commands/log.ts");
      return log(rest);
    }
    case "doc": {
      const { doc } = await import("./commands/doc.ts");
      return doc(rest);
    }
    case "task": {
      const { task } = await import("./commands/task.ts");
      return task(rest);
    }
    case "connect": {
      const { connect } = await import("./commands/connect.ts");
      return connect(rest);
    }
    case "repl": {
      const { repl } = await import("./commands/repl.tsx");
      return repl(rest);
    }
    case "auth": {
      const { auth } = await import("./commands/auth.ts");
      return auth(rest);
    }
    case "clear": {
      const { clear } = await import("./commands/clear.ts");
      return clear(rest);
    }
    default:
      printUsage();
      console.error(`\nUnknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
