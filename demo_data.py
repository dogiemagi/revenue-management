"""
Demo data seeder for RevTrack (Revenue & Expense Management).
Populates realistic individual and family records with Indian Rupee (₹)
currency option and itemized expenses (Groceries, Clothing, Other).
"""
from datetime import date
from models import db, User, Family, SalaryProfile, SalaryRecord, ExpenseRecord

def seed_demo_data():
    # Check if demo data already exists
    existing = User.query.filter_by(email="alex@revtrack.com").first()
    if existing:
        return {"status": "exists", "message": "Demo data already populated."}

    # 1. Create Family
    morgan_family = Family(
        name="Morgan Household",
        invite_code="MORG-2026"
    )
    db.session.add(morgan_family)
    db.session.flush()

    # 2. Main User: Alex Morgan (Family Admin)
    alex = User(
        name="Alex Morgan",
        email="alex@revtrack.com",
        job_title="Senior Software Architect",
        currency="₹", # Indian Rupee default
        family_id=morgan_family.id,
        is_family_admin=True
    )
    alex.set_password("password123")
    db.session.add(alex)
    db.session.flush()
    
    morgan_family.created_by_id = alex.id

    # Alex's Salary Profile (INR values)
    alex_profile = SalaryProfile(
        user_id=alex.id,
        pay_frequency="monthly",
        base_salary=150000.0,
        allowances=25000.0,
        bonus_expected=10000.0,
        tax_rate=15.0,
        pension_rate=6.0,
        insurance_deduction=3500.0,
        other_deductions=1500.0,
        standard_hours_per_week=40.0,
        overtime_rate_multiplier=1.5
    )
    db.session.add(alex_profile)

    # Alex's Salary Records (Monthly slips for past months)
    alex_records_data = [
        ("October 2026 Salary Disbursal", date(2026, 10, 1), 175000.0, 25000.0, 24900.0, 9000.0, 3500.0, 1500.0, 136100.0, "primary_job", "Monthly executive compensation"),
        ("September 2026 Salary Disbursal", date(2026, 9, 1), 175000.0, 25000.0, 24900.0, 9000.0, 3500.0, 1500.0, 136100.0, "primary_job", "Monthly executive compensation"),
        ("Q3 Architecture Milestone Bonus", date(2026, 8, 25), 50000.0, 0.0, 10000.0, 0.0, 0.0, 0.0, 40000.0, "bonus", "Q3 high-performance incentive"),
        ("August 2026 Salary Disbursal", date(2026, 8, 1), 175000.0, 25000.0, 24900.0, 9000.0, 3500.0, 1500.0, 136100.0, "primary_job", "Monthly executive compensation"),
        ("July 2026 Salary Disbursal", date(2026, 7, 1), 175000.0, 25000.0, 24900.0, 9000.0, 3500.0, 1500.0, 136100.0, "primary_job", "Monthly executive compensation"),
        ("Fintech API Architecture Advisory", date(2026, 6, 20), 45000.0, 0.0, 4500.0, 0.0, 0.0, 0.0, 40500.0, "freelance", "External cloud architecture consulting"),
    ]

    for title, p_date, gross, allow, tax, pen, ins, oth, net, cat, notes in alex_records_data:
        rec = SalaryRecord(
            user_id=alex.id,
            title=title,
            pay_date=p_date,
            frequency="monthly" if cat != "bonus" else "bonus",
            category=cat,
            gross_amount=gross,
            allowances=allow,
            tax_deduction=tax,
            pension_deduction=pen,
            insurance_deduction=ins,
            other_deductions=oth,
            net_amount=net,
            notes=notes
        )
        db.session.add(rec)

    # Alex's Expenses (Itemized across Groceries, Clothing, Other purchases)
    alex_expenses = [
        ("Monthly Supermarket & Organic Groceries", "groceries", 16500.0, date(2026, 10, 2), "monthly", "Monthly bulk grocery run & pantry restock"),
        ("Weekly Fresh Vegetables & Dairy Delivery", "groceries", 3200.0, date(2026, 10, 3), "weekly", "Fresh organic vegetables, fruits, and dairy"),
        ("Autumn & Festival Clothing Collection", "clothing", 14500.0, date(2026, 9, 28), "one_time", "Ethnic wear and casual linen shirts"),
        ("Designer Formal Suit & Footwear", "clothing", 9800.0, date(2026, 9, 15), "one_time", "Formal office attire and leather shoes"),
        ("High-Speed Fiber Broadband & Cloud Server", "utilities", 2499.0, date(2026, 10, 1), "monthly", "Airtel Xstream 1Gbps Fiber + cloud backup"),
        ("Electricity & Smart Home Utility Bill", "utilities", 4800.0, date(2026, 9, 20), "monthly", "State electricity distribution bill"),
        ("Ergonomic Monitor & Office Desk Accessories", "other", 7200.0, date(2026, 9, 10), "one_time", "Amazon purchase: mechanical keyboard and monitor arm"),
        ("Weekend Family Dinner & Gourmet Bistro", "dining", 5400.0, date(2026, 9, 26), "one_time", "Family celebration dinner"),
        ("Car Fuel & Highway FASTag Tolls", "transportation", 6500.0, date(2026, 9, 22), "monthly", "Monthly petrol and toll charges"),
    ]

    for title, cat, amt, e_date, rec_type, notes in alex_expenses:
        exp = ExpenseRecord(
            user_id=alex.id,
            title=title,
            category=cat,
            amount=amt,
            expense_date=e_date,
            recurrence=rec_type,
            notes=notes
        )
        db.session.add(exp)

    # 3. Family Member 2: Elena Morgan
    elena = User(
        name="Elena Morgan",
        email="elena@revtrack.com",
        job_title="Lead Product Designer",
        currency="₹",
        family_id=morgan_family.id,
        is_family_admin=False
    )
    elena.set_password("password123")
    db.session.add(elena)
    db.session.flush()

    elena_profile = SalaryProfile(
        user_id=elena.id,
        pay_frequency="monthly",
        base_salary=120000.0,
        allowances=18000.0,
        bonus_expected=6000.0,
        tax_rate=14.0,
        pension_rate=5.0,
        insurance_deduction=2800.0,
        other_deductions=1000.0
    )
    db.session.add(elena_profile)

    elena_records = [
        ("October 2026 Salary Disbursal", date(2026, 10, 1), 138000.0, 18000.0, 18480.0, 6000.0, 2800.0, 1000.0, 109720.0, "primary_job", "Design lead compensation"),
        ("September 2026 Salary Disbursal", date(2026, 9, 1), 138000.0, 18000.0, 18480.0, 6000.0, 2800.0, 1000.0, 109720.0, "primary_job", "Design lead compensation"),
    ]
    for title, p_date, gross, allow, tax, pen, ins, oth, net, cat, notes in elena_records:
        rec = SalaryRecord(
            user_id=elena.id,
            title=title,
            pay_date=p_date,
            frequency="monthly",
            category=cat,
            gross_amount=gross,
            allowances=allow,
            tax_deduction=tax,
            pension_deduction=pen,
            insurance_deduction=ins,
            other_deductions=oth,
            net_amount=net,
            notes=notes
        )
        db.session.add(rec)

    # 4. Family Member 3: Lucas Morgan
    lucas = User(
        name="Lucas Morgan",
        email="lucas@revtrack.com",
        job_title="Junior Data Analyst",
        currency="₹",
        family_id=morgan_family.id,
        is_family_admin=False
    )
    lucas.set_password("password123")
    db.session.add(lucas)
    db.session.flush()

    lucas_profile = SalaryProfile(
        user_id=lucas.id,
        pay_frequency="monthly",
        base_salary=65000.0,
        allowances=8000.0,
        bonus_expected=3000.0,
        tax_rate=10.0,
        pension_rate=4.0,
        insurance_deduction=1500.0,
        other_deductions=500.0
    )
    db.session.add(lucas_profile)

    lucas_records = [
        ("October 2026 Salary Disbursal", date(2026, 10, 1), 73000.0, 8000.0, 7040.0, 2600.0, 1500.0, 500.0, 61360.0, "primary_job", "Monthly analyst salary"),
        ("September 2026 Salary Disbursal", date(2026, 9, 1), 73000.0, 8000.0, 7040.0, 2600.0, 1500.0, 500.0, 61360.0, "primary_job", "Monthly analyst salary"),
    ]
    for title, p_date, gross, allow, tax, pen, ins, oth, net, cat, notes in lucas_records:
        rec = SalaryRecord(
            user_id=lucas.id,
            title=title,
            pay_date=p_date,
            frequency="monthly",
            category=cat,
            gross_amount=gross,
            allowances=allow,
            tax_deduction=tax,
            pension_deduction=pen,
            insurance_deduction=ins,
            other_deductions=oth,
            net_amount=net,
            notes=notes
        )
        db.session.add(rec)

    db.session.commit()
    return {"status": "success", "message": "Demo data populated successfully with INR (₹) and itemized expenses!"}
