# PAI Events

This document defines the event types sent to the PAI Daemon.

## Event Schema

Events sent from `capture-all-events.ts` follow this structure:

```typescript
interface PAIEvent {
  source_app: string;        // Agent type: "main", "Explore", "Plan", etc.
  session_id: string;        // Claude Code session ID
  hook_event_type: string;   // Claude Code hook event type
  payload: Record<string, any>;  // Full hook payload
  timestamp: number;         // Unix timestamp (ms)
  timestamp_local: string;   // Local time: "YYYY-MM-DD HH:MM:SS"
}
```

## Hook Event Types

Events map directly to Claude Code hook events:

| hook_event_type | When it fires |
|-----------------|---------------|
| `SessionStart` | Session begins |
| `UserPromptSubmit` | User sends message |
| `PreToolUse` | Before tool executes |
| `PostToolUse` | After tool executes |
| `Stop` | Main agent finishes responding |
| `SubagentStop` | Subagent completes |
| `SessionEnd` | Session closes |
| `PreCompact` | Before context compaction |

## Example Events

### SessionStart

```json
{
  "source_app": "main",
  "session_id": "abc123",
  "hook_event_type": "SessionStart",
  "payload": {
    "session_id": "abc123",
    "cwd": "/Users/erik/code/project"
  },
  "timestamp": 1705432800000,
  "timestamp_local": "2026-01-16 19:00:00"
}
```

### PreToolUse (Task tool - agent spawn)

```json
{
  "source_app": "main",
  "session_id": "abc123",
  "hook_event_type": "PreToolUse",
  "payload": {
    "session_id": "abc123",
    "tool_name": "Task",
    "tool_input": {
      "subagent_type": "Explore",
      "prompt": "Find all API endpoints",
      "description": "Search for endpoints"
    }
  },
  "timestamp": 1705432860000,
  "timestamp_local": "2026-01-16 19:01:00"
}
```

### Stop

```json
{
  "source_app": "main",
  "session_id": "abc123",
  "hook_event_type": "Stop",
  "payload": {
    "session_id": "abc123",
    "stop_hook_active": true
  },
  "timestamp": 1705432920000,
  "timestamp_local": "2026-01-16 19:02:00"
}
```

## Payload Details

The `payload` field contains the full hook data from Claude Code:

### Common Fields

| Field | Present in | Description |
|-------|------------|-------------|
| `session_id` | All events | Claude Code session identifier |
| `cwd` | SessionStart | Working directory |
| `tool_name` | PreToolUse, PostToolUse | Tool being invoked |
| `tool_input` | PreToolUse | Tool input parameters |
| `tool_output` | PostToolUse | Tool execution result |

### Tool-Specific Payloads

**Task tool** (agent spawning):
```json
{
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "Explore | Plan | Bash | ...",
    "prompt": "string",
    "description": "string"
  }
}
```

**Bash tool**:
```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "string",
    "description": "string"
  }
}
```

**Edit/Write tools**:
```json
{
  "tool_name": "Edit | Write",
  "tool_input": {
    "file_path": "string",
    "...": "..."
  }
}
```

## Event Delivery

### Configuration

Set the `PAI_DAEMON_URL` environment variable to enable daemon delivery:

```bash
export PAI_DAEMON_URL=https://pai.v10b.no
```

### Delivery Behavior

- Events are always written to local JSONL files
- If `PAI_DAEMON_URL` is set, events are also POSTed to `$PAI_DAEMON_URL/events`
- Daemon POST is fire-and-forget (failures don't block the hook)

### Local Storage

Events are stored locally at:
```
$PAI_DIR/history/raw-outputs/YYYY-MM/YYYY-MM-DD_all-events.jsonl
```
