from pydantic import BaseModel


class TimelineEvent(BaseModel):
    date: str
    title: str
    doctor: str | None = None
    hospital: str | None = None
    diagnosis: list[str]
