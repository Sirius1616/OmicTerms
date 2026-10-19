import logging

from sqlalchemy import text
from tenacity import before_sleep_log, retry, stop_after_attempt, wait_fixed

from app.crud import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

max_tries = 60 * 5  # 5 minutes
wait_seconds = 1


@retry(
    stop=stop_after_attempt(max_tries),
    wait=wait_fixed(wait_seconds),
    before_sleep=before_sleep_log(logger, logging.INFO),
)
def init() -> None:
    try:
        # Try to create session to check if DB is awake
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(e)
        raise


if __name__ == "__main__":
    init()
    logger.info("Database initialized")
