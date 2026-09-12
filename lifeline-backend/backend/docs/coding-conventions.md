# Lifeline Backend Coding Conventions

## Python Style

- Follow PEP 8.
- Use 4 spaces for indentation.
- Maximum line length: 88 characters.
- Use descriptive variable names.

Example:

```python
user_id = 123
```

Not:

```python
id = 123
```

---

## Naming

### Variables

snake_case

```python
user_name
emergency_contact
```

### Functions

snake_case

```python
get_user()
create_sos()
```

### Classes

PascalCase

```python
UserSchema
EmergencyContact
```

### Constants

UPPER_CASE

```python
MAX_RETRIES = 3
```

---

## Folder Responsibilities

api/routes/
- API endpoints only

services/
- Business logic

database/
- Database operations

schemas/
- Request & Response models

models/
- Database models (if added)

config/
- Settings only

utils/
- Shared helper functions

---

## Route Rules

Routes should NEVER contain business logic.

Good:

Route
↓

Service
↓

Database

Bad:

Route
↓

100 lines of logic

---

## Logging

Use Loguru.

```python
logger.info("User created")
logger.error("Database connection failed")
```

Never use:

```python
print()
```

---

## Environment Variables

Never hardcode:

- API keys
- URLs
- Secrets
- Tokens

Always use:

settings.SUPABASE_URL

instead of

"https://xyz.supabase.co"

---

## Error Handling

Always raise HTTPException.

Example:

```python
raise HTTPException(
    status_code=404,
    detail="User not found"
)
```

---

## API Responses

Success:

{
    "success": true,
    "data": {}
}

Error:

{
    "success": false,
    "message": "Something went wrong"
}

---

## Git Workflow

Never push directly to main without testing.

Commit frequently.

Commit messages:

feat: Add SOS endpoint

fix: Resolve login bug

docs: Update README

refactor: Clean auth service

---

## Before Every Commit

✓ Code runs

✓ No print()

✓ No secrets committed

✓ Requirements updated (if dependencies changed)

✓ Tests pass (if applicable)