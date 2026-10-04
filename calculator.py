"""
Salary & Revenue Calculation Engine
Handles multi-frequency calculations (Weekly, Bi-Weekly, Monthly, Yearly, Hourly),
itemized deductions, overtime multipliers, and tax projections.
"""

def normalize_to_annual(amount, frequency):
    """Normalize any frequency amount to annual figure."""
    amount = float(amount or 0.0)
    freq = (frequency or 'monthly').lower()
    
    if freq == 'hourly':
        return amount * 40 * 52 # standard 40h/week, 52 weeks
    elif freq == 'weekly':
        return amount * 52
    elif freq == 'biweekly':
        return amount * 26
    elif freq == 'monthly':
        return amount * 12
    elif freq in ('yearly', 'annual', 'annually'):
        return amount
    else:
        return amount * 12


def calculate_salary_breakdown(
    base_salary=5000.0,
    frequency='monthly',
    allowances=500.0,
    bonus_expected=0.0,
    tax_rate=15.0,
    pension_rate=5.0,
    insurance_deduction=150.0,
    other_deductions=50.0,
    standard_hours_per_week=40.0,
    overtime_hours=0.0,
    overtime_rate_multiplier=1.5
):
    """
    Computes a comprehensive salary breakdown for:
    - Weekly
    - Bi-Weekly
    - Monthly
    - Yearly
    
    Returns all figures rounded to 2 decimal places.
    """
    base_salary = float(base_salary or 0.0)
    allowances = float(allowances or 0.0)
    bonus_expected = float(bonus_expected or 0.0)
    tax_rate = float(tax_rate or 0.0)
    pension_rate = float(pension_rate or 0.0)
    insurance_deduction = float(insurance_deduction or 0.0)
    other_deductions = float(other_deductions or 0.0)
    standard_hours_per_week = float(standard_hours_per_week or 40.0)
    overtime_hours = float(overtime_hours or 0.0)
    overtime_rate_multiplier = float(overtime_rate_multiplier or 1.5)

    # 1. Normalize Base, Allowances, Insurance, Other to Annual equivalents
    annual_base = normalize_to_annual(base_salary, frequency)
    annual_allowances = normalize_to_annual(allowances, frequency)
    annual_bonus = normalize_to_annual(bonus_expected, frequency)
    
    # Overtime calculation: regular hourly rate based on annual base / 2080 hrs
    annual_hours = standard_hours_per_week * 52
    hourly_rate = annual_base / annual_hours if annual_hours > 0 else 0.0
    overtime_hourly_rate = hourly_rate * overtime_rate_multiplier
    
    # Normalize overtime hours (assumed input frequency matches frequency parameter)
    annual_overtime_hours = normalize_to_annual(overtime_hours, frequency)
    annual_overtime_pay = annual_overtime_hours * overtime_hourly_rate
    
    # Total Gross Annual
    annual_gross = annual_base + annual_allowances + annual_bonus + annual_overtime_pay
    
    # Deductions Annual
    # Pension is usually calculated on Base Salary
    annual_pension = annual_base * (pension_rate / 100.0)
    
    # Taxable amount after pension (pre-tax deduction)
    taxable_amount = max(0.0, annual_gross - annual_pension)
    annual_tax = taxable_amount * (tax_rate / 100.0)
    
    # Fixed insurance & other normalized to annual
    annual_insurance = normalize_to_annual(insurance_deduction, frequency)
    annual_other = normalize_to_annual(other_deductions, frequency)
    
    annual_total_deductions = annual_tax + annual_pension + annual_insurance + annual_other
    annual_net = max(0.0, annual_gross - annual_total_deductions)
    
    # Retention / Efficiency Rate (% of gross kept)
    retention_rate = (annual_net / annual_gross * 100.0) if annual_gross > 0 else 0.0
    effective_tax_rate = (annual_tax / annual_gross * 100.0) if annual_gross > 0 else 0.0
    
    def generate_period_dict(period_gross, period_base, period_allowances, period_bonus, period_overtime,
                             period_tax, period_pension, period_insurance, period_other, period_net):
        total_ded = period_tax + period_pension + period_insurance + period_other
        return {
            'gross': round(period_gross, 2),
            'base': round(period_base, 2),
            'allowances': round(period_allowances, 2),
            'bonus': round(period_bonus, 2),
            'overtime': round(period_overtime, 2),
            'tax': round(period_tax, 2),
            'pension': round(period_pension, 2),
            'insurance': round(period_insurance, 2),
            'other_deductions': round(period_other, 2),
            'total_deductions': round(total_ded, 2),
            'net': round(period_net, 2)
        }

    yearly = generate_period_dict(
        annual_gross, annual_base, annual_allowances, annual_bonus, annual_overtime_pay,
        annual_tax, annual_pension, annual_insurance, annual_other, annual_net
    )

    monthly = generate_period_dict(
        annual_gross / 12, annual_base / 12, annual_allowances / 12, annual_bonus / 12, annual_overtime_pay / 12,
        annual_tax / 12, annual_pension / 12, annual_insurance / 12, annual_other / 12, annual_net / 12
    )

    biweekly = generate_period_dict(
        annual_gross / 26, annual_base / 26, annual_allowances / 26, annual_bonus / 26, annual_overtime_pay / 26,
        annual_tax / 26, annual_pension / 26, annual_insurance / 26, annual_other / 26, annual_net / 26
    )

    weekly = generate_period_dict(
        annual_gross / 52, annual_base / 52, annual_allowances / 52, annual_bonus / 52, annual_overtime_pay / 52,
        annual_tax / 52, annual_pension / 52, annual_insurance / 52, annual_other / 52, annual_net / 52
    )
    
    daily = generate_period_dict(
        annual_gross / 260, annual_base / 260, annual_allowances / 260, annual_bonus / 260, annual_overtime_pay / 260,
        annual_tax / 260, annual_pension / 260, annual_insurance / 260, annual_other / 260, annual_net / 260
    )
    
    hourly = {
        'rate': round(hourly_rate, 2),
        'overtime_rate': round(overtime_hourly_rate, 2),
        'gross_hourly': round(annual_gross / annual_hours, 2) if annual_hours > 0 else 0.0,
        'net_hourly': round(annual_net / annual_hours, 2) if annual_hours > 0 else 0.0
    }

    return {
        'input_frequency': frequency,
        'yearly': yearly,
        'monthly': monthly,
        'biweekly': biweekly,
        'weekly': weekly,
        'daily': daily,
        'hourly': hourly,
        'rates': {
            'retention_rate': round(retention_rate, 1),
            'effective_tax_rate': round(effective_tax_rate, 1),
            'pension_rate': round(pension_rate, 1)
        }
    }
