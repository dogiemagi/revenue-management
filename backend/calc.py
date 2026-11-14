"""Multi-cadence salary engine (ported from the revenue-management reference project)."""

PER_YEAR = {"hourly": 40 * 52, "weekly": 52, "biweekly": 26, "monthly": 12, "yearly": 1}


def _annual(amount: float, freq: str) -> float:
    return float(amount or 0) * PER_YEAR.get(freq, 12)


def _r2(n: float) -> float:
    return round(n + 1e-9, 2) if n >= 0 else round(n - 1e-9, 2)


def calculate(p: dict) -> dict:
    freq = p.get("pay_frequency") or "monthly"
    hrs = float(p.get("standard_hours_per_week") or 40)
    mult = float(p.get("overtime_rate_multiplier") or 1.5)

    base = _annual(p.get("base_salary"), freq)
    allow = _annual(p.get("allowances"), freq)
    bonus = _annual(p.get("bonus_expected"), freq)
    hourly = base / (hrs * 52)
    ot_rate = hourly * mult
    overtime = _annual(p.get("overtime_hours"), freq) * ot_rate

    gross = base + allow + bonus + overtime
    pension = base * float(p.get("pension_rate") or 0) / 100
    tax = max(0.0, gross - pension) * float(p.get("tax_rate") or 0) / 100
    insurance = _annual(p.get("insurance_deduction"), freq)
    other = _annual(p.get("other_deductions"), freq)
    deductions = tax + pension + insurance + other
    net = max(0.0, gross - deductions)

    def period(d: int) -> dict:
        return {
            "gross": _r2(gross / d), "base": _r2(base / d), "allowances": _r2(allow / d),
            "bonus": _r2(bonus / d), "overtime": _r2(overtime / d), "tax": _r2(tax / d),
            "pension": _r2(pension / d), "insurance": _r2(insurance / d), "other": _r2(other / d),
            "total_deductions": _r2(deductions / d), "net": _r2(net / d),
        }

    return {
        "yearly": period(1), "monthly": period(12), "biweekly": period(26),
        "weekly": period(52), "daily": period(260),
        "hourly": {"rate": _r2(hourly), "overtime_rate": _r2(ot_rate),
                   "gross": _r2(gross / (hrs * 52)), "net": _r2(net / (hrs * 52))},
        "rates": {"retention": _r2(net / gross * 100) if gross else 0,
                  "effective_tax": _r2(tax / gross * 100) if gross else 0},
    }
