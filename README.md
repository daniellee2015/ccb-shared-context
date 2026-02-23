# ccb-shared-context

Shared context manager for CCB (Claude Code Bridge) - Cross-instance context sharing with permissions.

## Features

- Share context across CCB instances
- Three-tier permission system (public/team/private)
- Query and filter shared contexts
- Transfer context between instances
- Fine-grained access control
- Automatic cleanup of old contexts

## Installation

```bash
npm install -g ccb-shared-context
```

## Usage

### Share context

```bash
# Share with message
ccb-context share <instance-id> -m "Found a bug in auth.ts line 42"

# Share from file
ccb-context share <instance-id> -f ./context.md

# Share with specific permission
ccb-context share <instance-id> -m "Private note" -p private
```

### Query contexts

```bash
# Query all available contexts
ccb-context query

# Filter by instance
ccb-context query -i instance-123

# Filter by permission level
ccb-context query -p public

# Limit results
ccb-context query -l 5
```

### Transfer context

```bash
ccb-context transfer <context-id> <target-instance>
```

### Manage permissions

```bash
# Set permission level
ccb-context permissions <context-id> -s public

# Allow specific instance
ccb-context permissions <context-id> -a instance-456

# Deny specific instance
ccb-context permissions <context-id> -d instance-789
```

### List your contexts

```bash
ccb-context list
```

### Cleanup old contexts

```bash
# Remove contexts older than 7 days (default)
ccb-context clean

# Remove contexts older than 30 days
ccb-context clean -d 30
```

## Permission Levels

### Public
- Anyone can access
- Use for general information, tips, or public knowledge

### Team (default)
- Team members can access (same hostname)
- Use for project-specific context

### Private
- Only explicitly allowed instances can access
- Use for sensitive information or personal notes

## Architecture

### Shared Context Pool

Contexts are stored in `~/.ccb/shared-context/` as JSON files:

```json
{
  "id": "ctx-1234567890-abc123",
  "instanceId": "hostname-12345",
  "timestamp": 1708732800000,
  "message": "Context message",
  "permission": "team",
  "allowedInstances": [],
  "deniedInstances": [],
  "accessCount": 0
}
```

### Instance Detection

The manager automatically detects the current instance ID from:
1. `CCB_INSTANCE_ID` environment variable
2. Tmux session name
3. Fallback: hostname + PID

## Integration with CCB Multi

This tool is designed to work with CCB multi-instance development:

- Share context between parallel development sessions
- Coordinate work across multiple agents
- Transfer knowledge between instances
- Maintain context history

## Examples

### Scenario 1: Share a bug finding

```bash
# Instance A finds a bug
ccb-context share instance-a -m "Bug in auth.ts:42 - missing null check"

# Instance B queries and sees the context
ccb-context query
```

### Scenario 2: Private notes

```bash
# Share private context
ccb-context share my-instance -m "TODO: refactor database layer" -p private

# Allow specific instance to access
ccb-context permissions ctx-xxx -a trusted-instance
```

### Scenario 3: Team collaboration

```bash
# Share team context
ccb-context share team-lead -m "API design approved, proceed with implementation"

# All team members can query
ccb-context query -p team
```

## License

MIT
