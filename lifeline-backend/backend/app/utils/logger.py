from loguru import logger
from app.config.settings import settings
import sys

# Remove default logger
logger.remove()

# Log to terminal
logger.add(
    sys.stdout,
    level="INFO",
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
           "<level>{level}</level> | "
           "<cyan>{name}:{function}:{line}</cyan> - "
           "<level>{message}</level>"
)

# Log to file
logger.add(
    "logs/app.log",
    rotation="10 MB",
    retention="7 days",
    level=settings.LOG_LEVEL,
)
