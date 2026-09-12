# Lifeline Backend Folder Structure

## app/

Main application code.

### api/routes/

Contains all API endpoints.

Example:
- auth.py
- sos.py
- users.py

### api/dependencies/

Authentication and shared dependencies.

### config/

Application configuration.

Example:
- settings.py

### database/

Database clients.

Example:
- supabase.py

### models/

Database models.

### schemas/

Pydantic request and response models.

### services/

Business logic.

Examples:
- ai_service.py
- emergency_service.py
- notification_service.py

### utils/

Shared utilities.

Examples:
- logger.py
- helpers.py

---

## tests/

All backend tests.

---

## logs/

Application log files.

---

## Rules

- Never place business logic inside routes.
- Routes should call services.
- Services communicate with the database.
- Schemas define request and response models.
- Config stores application settings only.