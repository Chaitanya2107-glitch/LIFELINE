from datetime import datetime


def validate_dates(dates: list[str]) -> list[str]:
    valid_dates = []

    for date in dates:
        try:
            parsed = datetime.strptime(date, "%d/%m/%Y")
            valid_dates.append(parsed.strftime("%Y-%m-%d"))
        except ValueError:
            continue

    return valid_dates
