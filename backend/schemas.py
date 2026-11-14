"""Pydantic request models (validation lives here; errors are mapped to {"error": ...} in main.py)."""
import re
from datetime import date as _date
from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints, model_validator

CURRENCIES = ["INR", "USD", "EUR", "GBP"]
TYPES = ["Mutual Fund", "Stocks", "ETF", "Fixed Deposit", "Gold", "Crypto", "Real Estate", "PPF/EPF"]
CATS = ["Rent", "Groceries", "Utilities", "Transport", "Health", "Dining", "Shopping", "Entertainment", "Travel", "Other"]
FREQS = ["weekly", "biweekly", "monthly", "yearly", "hourly"]
SLIP_CATS = ["primary_job", "freelance", "side_hustle", "bonus"]


def _check_date(v: str) -> str:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        raise ValueError("bad date")
    _date.fromisoformat(v)
    return v


Day = Annotated[str, AfterValidator(_check_date)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Money = Annotated[float, Field(ge=0, le=1e12, allow_inf_nan=False)]
Positive = Annotated[float, Field(gt=0, le=1e12, allow_inf_nan=False)]
Percent = lambda hi: Annotated[float, Field(ge=0, le=hi, allow_inf_nan=False)]  # noqa: E731


class Form(BaseModel):
    """Base: ignores unknown keys; blank strings fall back to the field default (HTML forms send '')."""
    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def _blank_to_default(cls, d):
        if isinstance(d, dict):
            return {k: v for k, v in d.items() if not (v == "" and k in cls.model_fields and not cls.model_fields[k].is_required())}
        return d


class RegisterIn(Form):
    name: str = ""
    email: str = ""
    password: str = ""


class LoginIn(Form):
    email: str = ""
    password: str = ""


class TxIn(Form):
    date: Day
    desc: Name
    cat: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]   # built-in or user category, checked in the route
    amount: Positive
    kind: Literal["expense", "income"] = "expense"


class CategoryIn(Form):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
    bucket: Literal["needs", "wants"] = "wants"


class TxBulk(Form):
    items: Annotated[list[TxIn], Field(min_length=1, max_length=200)]


class HoldingIn(Form):
    name: Name
    type: Literal[tuple(TYPES)]
    invested: Money
    current: Optional[Money] = None
    sip: Money = 0


class HoldingBulk(Form):
    items: Annotated[list[HoldingIn], Field(min_length=1, max_length=100)]


class HoldingPatch(Form):
    current: Money


class GoalIn(Form):
    name: Name
    target: Annotated[float, Field(ge=1, le=1e12, allow_inf_nan=False)]
    saved: Money = 0
    date: Day


class PayslipIn(Form):
    fromProfile: bool = False
    title: Optional[Name] = None
    pay_date: Day
    category: Literal[tuple(SLIP_CATS)] = "primary_job"
    gross: Optional[Money] = None
    allowances: Money = 0
    tax: Money = 0
    pension: Money = 0
    insurance: Money = 0
    other: Money = 0
    notes: str = ""


class ProfileIn(Form):
    pay_frequency: Literal[tuple(FREQS)]
    base_salary: Money = 0
    allowances: Money = 0
    bonus_expected: Money = 0
    tax_rate: Percent(70) = 0
    pension_rate: Percent(50) = 0
    insurance_deduction: Money = 0
    other_deductions: Money = 0
    standard_hours_per_week: Annotated[float, Field(ge=1, le=100)] = 40
    overtime_hours: Money = 0
    overtime_rate_multiplier: Annotated[float, Field(ge=1, le=5)] = 1.5
    cash: Optional[Money] = None

    def profile(self) -> dict:
        return self.model_dump(exclude={"cash"})


class Alloc(Form):
    needs: Percent(100)
    wants: Percent(100)


class Growth(Form):
    years: Annotated[float, Field(ge=1, le=60)] = 20
    step: Percent(100) = 8
    infl: Percent(50) = 5
    target: Money = 10_000_000
    ret: Optional[Percent(100)] = None
    start: Optional[Money] = None
    monthly: Optional[Money] = None


class SettingsIn(Form):
    currency: Optional[Literal[tuple(CURRENCIES)]] = None
    theme: Optional[Literal["dark", "light"]] = None
    cash: Optional[Money] = None
    alloc: Optional[Alloc] = None
    growth: Optional[Growth] = None
    onboarded: Optional[bool] = None


class FamilyCreate(Form):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class FamilyJoin(Form):
    code: str = ""
