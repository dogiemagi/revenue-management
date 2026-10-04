"""
Demo data seeder for RevTrack (Revenue Management).
Populates realistic individual and family records for immediate visualization.
"""
from datetime import date
from models import db, User, Family, SalaryProfile, SalaryRecord

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
        currency="$",
        family_id=morgan_family.id,
        is_family_admin=True
    )
    alex.set_password("password123")
    db.session.add(alex)
    db.session.flush()
    
    morgan_family.created_by_id = alex.id

    # Alex's Salary Profile
    alex_profile = SalaryProfile(
        user_id=alex.id,
        pay_frequency="monthly",
        base_salary=8500.0,
        allowances=1200.0,
        bonus_expected=600.0,
        tax_rate=18.0,
        pension_rate=6.0,
        insurance_deduction=220.0,
        other_deductions=80.0,
        standard_hours_per_week=40.0,
        overtime_rate_multiplier=1.5
    )
    db.session.add(alex_profile)

    # Alex's Salary Records (Monthly slips for past 6 months)
    alex_records_data = [
        ("October 2026 Compensation", date(2026, 10, 1), 10300.0, 1200.0, 1720.0, 510.0, 220.0, 80.0, 7770.0, "primary_job", "Regular monthly pay slip"),
        ("September 2026 Compensation", date(2026, 9, 1), 10300.0, 1200.0, 1720.0, 510.0, 220.0, 80.0, 7770.0, "primary_job", "Regular monthly pay slip"),
        ("Q3 Performance Bonus", date(2026, 8, 25), 3500.0, 0.0, 700.0, 0.0, 0.0, 0.0, 2800.0, "bonus", "Exceeded team deliverables"),
        ("August 2026 Compensation", date(2026, 8, 1), 10300.0, 1200.0, 1720.0, 510.0, 220.0, 80.0, 7770.0, "primary_job", "Regular monthly pay slip"),
        ("July 2026 Compensation", date(2026, 7, 1), 10300.0, 1200.0, 1720.0, 510.0, 220.0, 80.0, 7770.0, "primary_job", "Regular monthly pay slip"),
        ("Cloud Architecture Advisory", date(2026, 6, 20), 2200.0, 0.0, 330.0, 0.0, 0.0, 0.0, 1870.0, "freelance", "External technical consultation"),
        ("June 2026 Compensation", date(2026, 6, 1), 10300.0, 1200.0, 1720.0, 510.0, 220.0, 80.0, 7770.0, "primary_job", "Regular monthly pay slip"),
        ("May 2026 Compensation", date(2026, 5, 1), 10300.0, 1200.0, 1720.0, 510.0, 220.0, 80.0, 7770.0, "primary_job", "Regular monthly pay slip"),
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

    # 3. Family Member 2: Elena Morgan
    elena = User(
        name="Elena Morgan",
        email="elena@revtrack.com",
        job_title="Lead Product Designer",
        currency="$",
        family_id=morgan_family.id,
        is_family_admin=False
    )
    elena.set_password("password123")
    db.session.add(elena)
    db.session.flush()

    elena_profile = SalaryProfile(
        user_id=elena.id,
        pay_frequency="monthly",
        base_salary=7200.0,
        allowances=900.0,
        bonus_expected=400.0,
        tax_rate=16.0,
        pension_rate=5.0,
        insurance_deduction=180.0,
        other_deductions=50.0
    )
    db.session.add(elena_profile)

    elena_records = [
        ("October 2026 Compensation", date(2026, 10, 1), 8100.0, 900.0, 1230.0, 360.0, 180.0, 50.0, 6280.0, "primary_job", "Design lead compensation"),
        ("September 2026 Compensation", date(2026, 9, 1), 8100.0, 900.0, 1230.0, 360.0, 180.0, 50.0, 6280.0, "primary_job", "Design lead compensation"),
        ("Design Sprint Workshop", date(2026, 8, 15), 1800.0, 0.0, 270.0, 0.0, 0.0, 0.0, 1530.0, "freelance", "External UX Design Workshop"),
        ("August 2026 Compensation", date(2026, 8, 1), 8100.0, 900.0, 1230.0, 360.0, 180.0, 50.0, 6280.0, "primary_job", "Design lead compensation"),
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
        currency="$",
        family_id=morgan_family.id,
        is_family_admin=False
    )
    lucas.set_password("password123")
    db.session.add(lucas)
    db.session.flush()

    lucas_profile = SalaryProfile(
        user_id=lucas.id,
        pay_frequency="monthly",
        base_salary=4200.0,
        allowances=400.0,
        bonus_expected=150.0,
        tax_rate=12.0,
        pension_rate=4.0,
        insurance_deduction=120.0,
        other_deductions=30.0
    )
    db.session.add(lucas_profile)

    lucas_records = [
        ("October 2026 Compensation", date(2026, 10, 1), 4600.0, 400.0, 530.0, 168.0, 120.0, 30.0, 3752.0, "primary_job", "Monthly analyst salary"),
        ("September 2026 Compensation", date(2026, 9, 1), 4600.0, 400.0, 530.0, 168.0, 120.0, 30.0, 3752.0, "primary_job", "Monthly analyst salary"),
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
    return {"status": "success", "message": "Demo data populated successfully!"}
