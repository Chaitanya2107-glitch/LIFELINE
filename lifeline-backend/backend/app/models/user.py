from typing import Optional, TypedDict


class UserRecord(TypedDict):
    """Typed representation of a row from the `users` table.

    users columns:
      id             BIGINT
      email          TEXT      UNIQUE NOT NULL
      name           TEXT      NOT NULL
      password_hash  TEXT      NOT NULL
      role           TEXT      NOT NULL  -- 'doctor' | 'clerk'
      specialization TEXT      nullable
      med_reg_no     TEXT      nullable at DB level; required for 'doctor' by app layer
      phone          TEXT      nullable
      created_at     TIMESTAMPTZ
    """
    id: int
    email: str
    name: str
    password_hash: str
    role: str
    specialization: Optional[str]
    med_reg_no: Optional[str]
    phone: Optional[str]
