#!/usr/bin/env bun
/**
 * aw — agent-worker CLI entry point.
 *
 * All commands route through AwClient (HTTP) except `daemon start` which starts the daemon directly.
 * If no daemon is running, commands that need it will auto-start one in the background.
 */

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1);

function printUsage() {
  console.log(`Usage: aw <command>

Daemon:
  daemon start [-p PORT]    Start daemon (foreground)
  daemon stop               Stop daemon
  status                    Daemon, agents, and workspaces overview

Resources:
  add <name> [options]        Add standalone agent
  create <config.yaml>        Create workspace (service mode)
  run <config.yaml>           Run workspace as task (exits when done)
  ls                          List all agents + workspaces
  info <target>               Details about agent/workspace
  rm <target>                 Remove agent or stop workspace

Messaging:
  send <target> "message"     Send message(s)
  read <target> [N]           Read N messages from a stream
  repl <target>               Interactive chat (non-blocking send/receive)

Inspection:
  state <target>              Agent state, inbox, todos
  peek <target>               Read history from start
  log [<target>] [-f]         Event log (--follow for streaming)

Documents:
  doc ls [@workspace]         List documents
  doc read <name>             Read document
  doc write <name> --content  Write document
  doc append <name> --content Append to document

Auth:
  auth <provider>             Save API key (anthropic, openai, google, deepseek, ...)
  auth status                 Show provider auth status
  auth rm <provider>          Remove a saved API key

Connections:
  connect telegram            Connect a Telegram bot (full setup flow)
  connect status              Show all configured connections
  connect rm <name>           Remove a saved connection

Target syntax: [agent][@workspace[:tag]][#channel]
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
