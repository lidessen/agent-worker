# Workspace-First Design Principles

## Purpose

This document defines the project-wide design philosophy for `agent-worker`.
It is intended to guide architecture decisions across `loop`, `agent`,
`workspace`, `harness`, persistence, evaluation, and product UX.

## One-Sentence Positioning

`agent-worker` is not a monolithic chat agent. It is a workspace-centric
long-term engineering system in which persistent workspaces carry continuity,
while short-lived agents enter, work, hand off, and leave.

## Core Thesis

Traditional agent systems are usually conversation-first:

- the primary object is a chat session
- the agent's continuity comes from conversation history
- tools are attached to the chat loop

This project takes a different position:

- the primary object is the workspace
- continuity comes from persistent system memory, not from a single agent
- conversation is only one kind of work artifact
- agents are replaceable workers operating inside a virtual workplace

The practical model is not "a user talks to an agent".
The practical model is "a worker enters a workplace, reads the current state of
work, uses tools, produces artifacts, records progress, and hands off to the
next worker".

## Primary Objects

The following are first-class system objects:

- `workspace`
- `task`
- `artifact`
- `event`
- `state`
- `handoff`
- `tool environment`

Conversation transcripts are secondary objects. They may contain intent,
coordination, or explanations, but they are not the system backbone.

## Guiding Principles

### 1. Workspace First

The workspace is the unit of continuity.
Engineering progress must survive individual agent turnover.

Design implication:

- persistent state must live in the workspace
- work must remain understandable without replaying the entire transcript

### 2. Agents Are Replaceable Labor

An agent is a short-lived worker, not a permanent identity that the system
depends on.

Design implication:

- any agent should be stoppable and replaceable at any time
- no critical progress may depend on private, hidden, in-context-only state

### 3. Memory Lives in the System

Long-term memory must be externalized into durable system structures.

Examples:

- task state
- work logs
- decision records
- artifacts and outputs
- environment snapshots
- failures and recovery notes
- handoff summaries

Design implication:

- if continuity matters, it must be stored outside the transient model context

### 4. Conversation Is Secondary

Conversation is useful, but it is not the main execution substrate.

Conversation is good for:

- expressing user intent
- asking for clarification
- recording discussion
- negotiating decisions

It is not sufficient as the primary execution memory for long-running work.

### 5. Work Happens in a Virtual Workplace

Agents should operate like workers in a workplace, not like disembodied chat
responders.

They should:

- inspect files
- read logs
- observe state
- use tools
- update artifacts
- leave explicit records

Design implication:

- the tool environment is part of the core product, not an add-on

### 6. Reuse Mature Loops, Own the Harness

We do not aim to compete with AI SDK, Claude Code, Codex, or similar systems on
their core single-agent loop quality.

We should reuse mature loop capabilities where they are already strong:

- tool use
- iterative reasoning
- error recovery inside a run
- model-specific integration behavior

We should own the higher-level harness:

- workspace loading
- context assembly
- event recording
- persistence
- handoff generation
- lifecycle management
- recovery and resume

### 7. State Over Transcript

Execution should be driven primarily by explicit state, not by replaying long
message history.

When an agent starts work, the preferred input order is:

1. current task state
2. recent events
3. latest handoff
4. key artifacts
5. relevant discussion

Not:

1. full conversation replay

### 8. Handoff Is First-Class

Handoff is not an edge case. It is the default operating model.

Every meaningful run should leave behind enough state for the next agent to
continue without relying on hidden context.

A good handoff should answer:

- what was attempted
- what changed
- what remains
- what is blocked
- what the next worker should inspect first

### 9. Separate Facts From Narratives

The system must distinguish between facts and interpretations.

Facts:

- commands executed
- files changed
- test results
- events observed
- timestamps

Narratives:

- why a choice was made
- current diagnosis
- suggested next step

Design implication:

- facts should be durable and auditable
- narratives should be revisable and attributable

### 10. Prefer Event-Sourced Thinking

State matters, but state alone is not enough.
We should preserve the important sequence of events that led to the current
state.

Design implication:

- recovery, audit, debugging, and re-planning should rely on an event trail
- the system should not collapse all history into a single mutable summary

### 11. Context Is a Budgeted Resource

Model context is scarce and expensive.
The system must construct the smallest sufficient working context for each run.

Design implication:

- context building is a harness responsibility
- loading everything by default is a design failure
- summarization and retrieval must serve execution, not just storage

### 12. Failure Is Normal

Agents will fail, misunderstand, timeout, or partially complete work.
This must be treated as a normal engineering condition.

Design implication:

- the system should optimize for recoverability, not for the illusion of perfect
  single-run success

### 13. Model-Agnostic Core

The workspace protocol should outlive any individual model vendor.

Design implication:

- loop adapters may be model-specific
- workspace state, event schema, handoff schema, and task lifecycle should be
  stable across providers

### 14. Auditability Over Magic

Long-term engineering systems must be inspectable.
Important actions should be reconstructable after the fact.

Design implication:

- avoid opaque state transitions where possible
- preserve enough evidence to explain why the system did what it did

### 15. Continuity Over Single-Run Brilliance

The project is optimized for sustained progress over time, not for maximizing
the apparent intelligence of a single agent session.

Primary question:

- can the work continue tomorrow, next week, or next month?

Not just:

- was one run impressive?

## Architectural Consequences

These principles imply a layered architecture:

### Loop

The loop is responsible for a single working session:

- think
- call tools
- react to tool output
- produce a local result

### Harness

The harness is responsible for preparing and closing each working session:

- select the task focus
- assemble minimal sufficient context
- inject tools and permissions
- record events and outputs
- persist work products
- create handoff material
- support retry and resume

### Workspace System

The workspace system is responsible for long-term continuity:

- state model
- artifact storage
- event log
- task lifecycle
- memory layers
- agent lifecycle
- coordination between workers

## Non-Goals

This project is not primarily trying to:

- build a single always-on super-agent with irreplaceable private context
- optimize around chat transcript fidelity as the main memory mechanism
- beat specialized agent products at their own monolithic loop implementation
- treat all work as request-response conversation

## Design Review Questions

Any major design in this project should be reviewable against the following
questions:

1. Does this strengthen the workspace as the unit of continuity?
2. Can a different agent continue the work without hidden context?
3. Is important memory stored in the system rather than implied by chat history?
4. Does the design separate durable facts from changing interpretation?
5. Does it improve handoff quality?
6. Does it reduce unnecessary context load?
7. Is the behavior inspectable and auditable after the fact?
8. Is the provider-specific logic isolated below the workspace protocol?
9. Does this help long-term engineering continuity more than it helps a single
   run look smart?

## Project Statement

The goal of `agent-worker` is not to create an all-powerful persistent chat
agent.

The goal is to build a long-term work system where:

- the workspace preserves memory
- the harness prepares and records work
- agents execute short-lived tasks inside that environment
- engineering progress continues even as individual agents come and go

That is the default lens for evaluating future design choices in this project.
