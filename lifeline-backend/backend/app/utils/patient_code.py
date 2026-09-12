import random
import string


def generate_patient_code() -> str:
    """Generate a unique patient code of the form LFL-XXXXXX.

    The 6-character suffix is drawn from uppercase ASCII letters and digits.
    Collision checking is the responsibility of the caller (patient service),
    which should retry on a unique-constraint violation.

    Examples:
        "LFL-A1B2C3"
        "LFL-XZ9Q4R"
    """
    suffix = "".join(
        random.choices(string.ascii_uppercase + string.digits, k=6)
    )
    return f"LFL-{suffix}"
