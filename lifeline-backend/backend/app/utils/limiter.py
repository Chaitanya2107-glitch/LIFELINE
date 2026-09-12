from slowapi import Limiter
from slowapi.util import get_remote_address

# Singleton Limiter instance — imported by main.py (middleware registration)
# and by route modules that apply @limiter.limit() decorators.
limiter = Limiter(key_func=get_remote_address)
