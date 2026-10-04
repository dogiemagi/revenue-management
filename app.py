import os
from functools import wraps
from datetime import datetime, date
import csv
import io

from flask import (
    Flask, render_template, request, redirect, url_for, 
    flash, session, jsonify, Response
)
from werkzeug.security import check_password_hash

from config import Config
from models import db, User, Family, SalaryProfile, SalaryRecord, ExpenseRecord
from calculator import calculate_salary_breakdown, normalize_to_annual, calculate_expense_summary
from demo_data import seed_demo_data

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

# Ensure database tables exist upon start & safely add is_onboarded if missing
with app.app_context():
    db.create_all()
    try:
        from sqlalchemy import text
        db.session.execute(text("ALTER TABLE users ADD COLUMN is_onboarded BOOLEAN DEFAULT FALSE"))
        db.session.commit()
    except Exception:
        db.session.rollback()

# -------------------------------------------------------------
# Authentication & Access Decorators
# -------------------------------------------------------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please sign in to access your revenue and expense dashboard.", "warning")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def get_current_user():
    user_id = session.get('user_id')
    if user_id:
        return User.query.get(user_id)
    return None

@app.context_processor
def inject_global_data():
    current_user = get_current_user()
    show_onboarding = False
    if current_user:
        show_onboarding = not getattr(current_user, 'is_onboarded', True)
    return {
        'current_user': current_user,
        'show_onboarding': show_onboarding,
        'current_year': datetime.utcnow().year,
        'now': datetime.utcnow()
    }

# -------------------------------------------------------------
# Public & Auth Routes
# -------------------------------------------------------------
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['user_name'] = user.name
            flash(f"Welcome back, {user.name}!", "success")
            return redirect(url_for('dashboard'))
        else:
            flash("Invalid email or password. Please try again.", "danger")
            
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        job_title = request.form.get('job_title', 'Professional').strip()
        currency = request.form.get('currency', '₹').strip() # Default to Indian Rupee (₹)
        account_type = request.form.get('account_type', 'personal')
        
        if not name or not email or not password:
            flash("Please fill in all required fields.", "warning")
            return render_template('register.html')
            
        if User.query.filter_by(email=email).first():
            flash("An account with this email already exists.", "danger")
            return render_template('register.html')
            
        user = User(
            name=name,
            email=email,
            job_title=job_title,
            currency=currency,
            is_onboarded=False
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        # Handle Family Options
        if account_type == 'create_family':
            family_name = request.form.get('family_name', f"{name}'s Household").strip()
            family = Family(
                name=family_name,
                invite_code=Family.generate_invite_code(),
                created_by_id=user.id
            )
            db.session.add(family)
            db.session.flush()
            user.family_id = family.id
            user.is_family_admin = True
        elif account_type == 'join_family':
            invite_code = request.form.get('invite_code', '').strip().upper()
            family = Family.query.filter_by(invite_code=invite_code).first()
            if family:
                user.family_id = family.id
                user.is_family_admin = False
            else:
                flash("Invalid family invite code. Account created as personal.", "info")

        # Initialize Default Salary Profile with Indian Rupee defaults
        profile = SalaryProfile(
            user_id=user.id,
            pay_frequency="monthly",
            base_salary=75000.0,
            allowances=12000.0,
            bonus_expected=3000.0,
            tax_rate=15.0,
            pension_rate=6.0,
            insurance_deduction=2500.0,
            other_deductions=1000.0
        )
        db.session.add(profile)
        db.session.commit()
        
        session['user_id'] = user.id
        session['user_name'] = user.name
        flash("Your RevTrack account has been successfully created!", "success")
        return redirect(url_for('dashboard'))

    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash("You have been signed out safely.", "info")
    return redirect(url_for('login'))

@app.route('/demo-login', methods=['POST'])
def demo_login():
    """1-Click Demo Login as Alex Morgan (seeds sample data if missing)"""
    seed_demo_data()
    alex = User.query.filter_by(email="alex@revtrack.com").first()
    if alex:
        session['user_id'] = alex.id
        session['user_name'] = alex.name
        flash("Logged into Demo Account (Morgan Household) with live sample salary & expense data in INR (₹)!", "success")
        return redirect(url_for('dashboard'))
    flash("Could not initialize demo account.", "danger")
    return redirect(url_for('login'))

@app.route('/seed-demo', methods=['POST'])
@login_required
def seed_demo():
    """Seeds sample data into the database"""
    result = seed_demo_data()
    flash(result['message'], "info")
    return redirect(url_for('dashboard'))

@app.route('/currency/switch', methods=['POST'])
@login_required
def switch_currency():
    """Quick currency switcher for INR (₹), USD ($), EUR (€), GBP (£), etc."""
    user = get_current_user()
    new_currency = request.form.get('currency', '₹').strip()
    user.currency = new_currency
    db.session.commit()
    flash(f"Active currency updated to {new_currency} throughout the application.", "success")
    return redirect(request.referrer or url_for('dashboard'))

# -------------------------------------------------------------
# Main Application Dashboard
# -------------------------------------------------------------
@app.route('/dashboard')
@login_required
def dashboard():
    user = get_current_user()
    profile = user.profile
    if not profile:
        profile = SalaryProfile(user_id=user.id)
        db.session.add(profile)
        db.session.commit()

    # Calculate current user's salary breakdown
    calc = calculate_salary_breakdown(
        base_salary=profile.base_salary,
        frequency=profile.pay_frequency,
        allowances=profile.allowances,
        bonus_expected=profile.bonus_expected,
        tax_rate=profile.tax_rate,
        pension_rate=profile.pension_rate,
        insurance_deduction=profile.insurance_deduction,
        other_deductions=profile.other_deductions,
        standard_hours_per_week=profile.standard_hours_per_week,
        overtime_rate_multiplier=profile.overtime_rate_multiplier
    )

    # Calculate Expenses Summary (Groceries, Clothes, Other)
    expenses_list = ExpenseRecord.query.filter_by(user_id=user.id).all()
    exp_summary = calculate_expense_summary(expenses_list, calc['monthly']['net'])

    # Fetch user's recent salary slips (last 5)
    recent_records = SalaryRecord.query.filter_by(user_id=user.id).order_by(SalaryRecord.pay_date.desc()).limit(5).all()

    # Calculate total earned in records
    all_records = SalaryRecord.query.filter_by(user_id=user.id).all()
    total_earned_history = sum(r.net_amount for r in all_records)
    total_tax_paid_history = sum(r.tax_deduction for r in all_records)

    return render_template(
        'dashboard.html',
        user=user,
        profile=profile,
        calc=calc,
        exp_summary=exp_summary,
        recent_records=recent_records,
        total_earned_history=round(total_earned_history, 2),
        total_tax_paid_history=round(total_tax_paid_history, 2)
    )

# -------------------------------------------------------------
# Expense & Spending Management
# -------------------------------------------------------------
@app.route('/expenses')
@login_required
def expenses_view():
    user = get_current_user()
    category_filter = request.args.get('category', 'all')
    
    query = ExpenseRecord.query.filter_by(user_id=user.id)
    if category_filter != 'all':
        query = query.filter_by(category=category_filter)
        
    expenses_list = query.order_by(ExpenseRecord.expense_date.desc()).all()
    all_expenses = ExpenseRecord.query.filter_by(user_id=user.id).all()

    # User's monthly net salary for savings calculations
    prof = user.profile or SalaryProfile(user_id=user.id)
    calc = calculate_salary_breakdown(
        base_salary=prof.base_salary,
        frequency=prof.pay_frequency,
        allowances=prof.allowances,
        bonus_expected=prof.bonus_expected,
        tax_rate=prof.tax_rate,
        pension_rate=prof.pension_rate,
        insurance_deduction=prof.insurance_deduction,
        other_deductions=prof.other_deductions
    )
    monthly_net_income = calc['monthly']['net']
    
    exp_summary = calculate_expense_summary(all_expenses, monthly_net_income)

    return render_template(
        'expenses.html',
        user=user,
        expenses=expenses_list,
        exp_summary=exp_summary,
        category_filter=category_filter,
        monthly_net_income=round(monthly_net_income, 2)
    )

@app.route('/expenses/add', methods=['POST'])
@login_required
def add_expense():
    user = get_current_user()
    
    title = request.form.get('title', 'Expense').strip()
    category = request.form.get('category', 'groceries').strip()
    amount = float(request.form.get('amount', 0.0) or 0.0)
    expense_date_str = request.form.get('expense_date', datetime.utcnow().strftime('%Y-%m-%d'))
    recurrence = request.form.get('recurrence', 'one_time')
    notes = request.form.get('notes', '').strip()

    try:
        parsed_date = datetime.strptime(expense_date_str, '%Y-%m-%d').date()
    except ValueError:
        parsed_date = datetime.utcnow().date()

    expense = ExpenseRecord(
        user_id=user.id,
        title=title,
        category=category,
        amount=amount,
        expense_date=parsed_date,
        recurrence=recurrence,
        notes=notes
    )
    db.session.add(expense)
    db.session.commit()

    flash(f"Expense '{title}' of {user.currency}{amount:,.2f} recorded!", "success")
    return redirect(request.referrer or url_for('expenses_view'))

@app.route('/expenses/<int:expense_id>/delete', methods=['POST'])
@login_required
def delete_expense(expense_id):
    user = get_current_user()
    expense = ExpenseRecord.query.filter_by(id=expense_id, user_id=user.id).first_or_404()
    db.session.delete(expense)
    db.session.commit()
    flash("Expense entry removed.", "info")
    return redirect(request.referrer or url_for('expenses_view'))

@app.route('/api/expense-chart-data')
@login_required
def expense_chart_data():
    user = get_current_user()
    all_expenses = ExpenseRecord.query.filter_by(user_id=user.id).all()
    prof = user.profile or SalaryProfile(user_id=user.id)
    calc = calculate_salary_breakdown(base_salary=prof.base_salary, frequency=prof.pay_frequency)
    summary = calculate_expense_summary(all_expenses, calc['monthly']['net'])
    return jsonify(summary)

# -------------------------------------------------------------
# Family / Household View
# -------------------------------------------------------------
@app.route('/family')
@login_required
def family_view():
    user = get_current_user()
    
    if not user.family_id:
        return render_template('family_empty.html', user=user)

    family = Family.query.get(user.family_id)
    members = family.members

    # Aggregate family calculations
    members_data = []
    total_monthly_gross = 0.0
    total_monthly_net = 0.0
    total_monthly_tax = 0.0
    total_annual_gross = 0.0
    total_annual_net = 0.0

    for m in members:
        prof = m.profile or SalaryProfile(user_id=m.id)
        m_calc = calculate_salary_breakdown(
            base_salary=prof.base_salary,
            frequency=prof.pay_frequency,
            allowances=prof.allowances,
            bonus_expected=prof.bonus_expected,
            tax_rate=prof.tax_rate,
            pension_rate=prof.pension_rate,
            insurance_deduction=prof.insurance_deduction,
            other_deductions=prof.other_deductions
        )
        m_monthly_net = m_calc['monthly']['net']
        m_monthly_gross = m_calc['monthly']['gross']
        m_annual_net = m_calc['yearly']['net']
        m_annual_gross = m_calc['yearly']['gross']
        
        total_monthly_gross += m_monthly_gross
        total_monthly_net += m_monthly_net
        total_monthly_tax += m_calc['monthly']['tax']
        total_annual_gross += m_annual_gross
        total_annual_net += m_annual_net

        members_data.append({
            'user': m,
            'calc': m_calc,
            'monthly_net': m_monthly_net,
            'monthly_gross': m_monthly_gross,
            'annual_net': m_annual_net
        })

    # Sort members by monthly net descending
    members_data.sort(key=lambda x: x['monthly_net'], reverse=True)

    # Compute contribution percentages
    for item in members_data:
        item['contribution_pct'] = round((item['monthly_net'] / total_monthly_net * 100.0), 1) if total_monthly_net > 0 else 0.0

    return render_template(
        'family.html',
        family=family,
        user=user,
        members_data=members_data,
        total_monthly_gross=round(total_monthly_gross, 2),
        total_monthly_net=round(total_monthly_net, 2),
        total_monthly_tax=round(total_monthly_tax, 2),
        total_annual_gross=round(total_annual_gross, 2),
        total_annual_net=round(total_annual_net, 2),
        active_earners=len([m for m in members_data if m['monthly_net'] > 0])
    )

@app.route('/family/create', methods=['POST'])
@login_required
def create_family():
    user = get_current_user()
    family_name = request.form.get('family_name', '').strip()
    
    if not family_name:
        flash("Please provide a name for your family household.", "warning")
        return redirect(url_for('family_view'))

    family = Family(
        name=family_name,
        invite_code=Family.generate_invite_code(),
        created_by_id=user.id
    )
    db.session.add(family)
    db.session.flush()

    user.family_id = family.id
    user.is_family_admin = True
    db.session.commit()

    flash(f"Family '{family.name}' created! Share code {family.invite_code} with family members.", "success")
    return redirect(url_for('family_view'))

@app.route('/family/join', methods=['POST'])
@login_required
def join_family():
    user = get_current_user()
    invite_code = request.form.get('invite_code', '').strip().upper()

    family = Family.query.filter_by(invite_code=invite_code).first()
    if not family:
        flash("Family invite code not found. Please verify and try again.", "danger")
        return redirect(url_for('family_view'))

    user.family_id = family.id
    user.is_family_admin = False
    db.session.commit()

    flash(f"You have joined the '{family.name}' household!", "success")
    return redirect(url_for('family_view'))

@app.route('/family/leave', methods=['POST'])
@login_required
def leave_family():
    user = get_current_user()
    if user.family_id:
        user.family_id = None
        user.is_family_admin = False
        db.session.commit()
        flash("You have switched back to independent personal mode.", "info")
    return redirect(url_for('dashboard'))

# -------------------------------------------------------------
# Salary Records Management
# -------------------------------------------------------------
@app.route('/records')
@login_required
def records():
    user = get_current_user()
    category_filter = request.args.get('category', 'all')
    
    query = SalaryRecord.query.filter_by(user_id=user.id)
    if category_filter != 'all':
        query = query.filter_by(category=category_filter)
        
    records_list = query.order_by(SalaryRecord.pay_date.desc()).all()
    
    total_gross = sum(r.gross_amount for r in records_list)
    total_net = sum(r.net_amount for r in records_list)
    total_tax = sum(r.tax_deduction for r in records_list)

    return render_template(
        'records.html',
        records=records_list,
        user=user,
        category_filter=category_filter,
        total_gross=round(total_gross, 2),
        total_net=round(total_net, 2),
        total_tax=round(total_tax, 2)
    )

@app.route('/records/add', methods=['POST'])
@login_required
def add_record():
    user = get_current_user()
    
    title = request.form.get('title', 'Salary Payment').strip()
    pay_date_str = request.form.get('pay_date', datetime.utcnow().strftime('%Y-%m-%d'))
    frequency = request.form.get('frequency', 'monthly')
    category = request.form.get('category', 'primary_job')
    
    gross_amount = float(request.form.get('gross_amount', 0.0) or 0.0)
    allowances = float(request.form.get('allowances', 0.0) or 0.0)
    tax_deduction = float(request.form.get('tax_deduction', 0.0) or 0.0)
    pension_deduction = float(request.form.get('pension_deduction', 0.0) or 0.0)
    insurance_deduction = float(request.form.get('insurance_deduction', 0.0) or 0.0)
    other_deductions = float(request.form.get('other_deductions', 0.0) or 0.0)
    
    # Net calculation
    total_deductions = tax_deduction + pension_deduction + insurance_deduction + other_deductions
    net_amount = max(0.0, (gross_amount + allowances) - total_deductions)
    
    notes = request.form.get('notes', '').strip()

    try:
        parsed_date = datetime.strptime(pay_date_str, '%Y-%m-%d').date()
    except ValueError:
        parsed_date = datetime.utcnow().date()

    record = SalaryRecord(
        user_id=user.id,
        title=title,
        pay_date=parsed_date,
        frequency=frequency,
        category=category,
        gross_amount=gross_amount,
        allowances=allowances,
        tax_deduction=tax_deduction,
        pension_deduction=pension_deduction,
        insurance_deduction=insurance_deduction,
        other_deductions=other_deductions,
        net_amount=net_amount,
        notes=notes
    )
    db.session.add(record)
    db.session.commit()

    flash(f"Record '{title}' added successfully!", "success")
    return redirect(request.referrer or url_for('records'))

@app.route('/records/<int:record_id>/delete', methods=['POST'])
@login_required
def delete_record(record_id):
    user = get_current_user()
    record = SalaryRecord.query.filter_by(id=record_id, user_id=user.id).first_or_404()
    db.session.delete(record)
    db.session.commit()
    flash("Salary record removed.", "info")
    return redirect(request.referrer or url_for('records'))

@app.route('/records/<int:record_id>/print')
@login_required
def print_slip(record_id):
    user = get_current_user()
    record = SalaryRecord.query.filter_by(id=record_id, user_id=user.id).first_or_404()
    return render_template('print_slip.html', record=record, user=user)

@app.route('/records/export/csv')
@login_required
def export_csv():
    user = get_current_user()
    records_list = SalaryRecord.query.filter_by(user_id=user.id).order_by(SalaryRecord.pay_date.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'ID', 'Title', 'Date', 'Category', 'Frequency', 
        'Gross Amount', 'Allowances', 'Tax Deduction', 'Pension Deduction', 
        'Insurance', 'Other Deductions', 'Net Take-Home', 'Notes'
    ])
    
    for r in records_list:
        writer.writerow([
            r.id, r.title, r.pay_date.strftime('%Y-%m-%d'), r.category, r.frequency,
            r.gross_amount, r.allowances, r.tax_deduction, r.pension_deduction,
            r.insurance_deduction, r.other_deductions, r.net_amount, r.notes or ''
        ])
        
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=RevTrack_Salary_Records_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )

# -------------------------------------------------------------
# Interactive Salary Calculator Page & API
# -------------------------------------------------------------
@app.route('/calculator')
def calculator_page():
    user = get_current_user()
    defaults = {
        'base_salary': 75000.0,
        'frequency': 'monthly',
        'allowances': 12000.0,
        'bonus': 3000.0,
        'tax_rate': 15.0,
        'pension_rate': 6.0,
        'insurance': 2500.0,
        'other': 1000.0,
        'currency': '₹'
    }
    if user and user.profile:
        p = user.profile
        defaults['base_salary'] = p.base_salary
        defaults['frequency'] = p.pay_frequency
        defaults['allowances'] = p.allowances
        defaults['bonus'] = p.bonus_expected
        defaults['tax_rate'] = p.tax_rate
        defaults['pension_rate'] = p.pension_rate
        defaults['insurance'] = p.insurance_deduction
        defaults['other'] = p.other_deductions
        defaults['currency'] = user.currency

    return render_template('calculator.html', defaults=defaults)

@app.route('/api/calculate', methods=['POST'])
def api_calculate():
    data = request.get_json() or {}
    
    base_salary = float(data.get('base_salary', 75000.0) or 0.0)
    frequency = data.get('frequency', 'monthly')
    allowances = float(data.get('allowances', 0.0) or 0.0)
    bonus = float(data.get('bonus', 0.0) or 0.0)
    tax_rate = float(data.get('tax_rate', 15.0) or 0.0)
    pension_rate = float(data.get('pension_rate', 6.0) or 0.0)
    insurance = float(data.get('insurance', 0.0) or 0.0)
    other = float(data.get('other', 0.0) or 0.0)
    hours = float(data.get('hours', 40.0) or 40.0)
    overtime_hours = float(data.get('overtime_hours', 0.0) or 0.0)
    overtime_mult = float(data.get('overtime_mult', 1.5) or 1.5)

    breakdown = calculate_salary_breakdown(
        base_salary=base_salary,
        frequency=frequency,
        allowances=allowances,
        bonus_expected=bonus,
        tax_rate=tax_rate,
        pension_rate=pension_rate,
        insurance_deduction=insurance,
        other_deductions=other,
        standard_hours_per_week=hours,
        overtime_hours=overtime_hours,
        overtime_rate_multiplier=overtime_mult
    )
    return jsonify(breakdown)

# -------------------------------------------------------------
# Profile & Settings Update
# -------------------------------------------------------------
@app.route('/profile/update', methods=['POST'])
@login_required
def update_profile():
    user = get_current_user()
    
    # Update User Info
    user.name = request.form.get('name', user.name).strip()
    user.job_title = request.form.get('job_title', user.job_title).strip()
    user.currency = request.form.get('currency', user.currency).strip()

    # Update Salary Profile
    profile = user.profile or SalaryProfile(user_id=user.id)
    profile.pay_frequency = request.form.get('pay_frequency', 'monthly')
    profile.base_salary = float(request.form.get('base_salary', profile.base_salary) or 0.0)
    profile.allowances = float(request.form.get('allowances', profile.allowances) or 0.0)
    profile.bonus_expected = float(request.form.get('bonus_expected', profile.bonus_expected) or 0.0)
    profile.tax_rate = float(request.form.get('tax_rate', profile.tax_rate) or 0.0)
    profile.pension_rate = float(request.form.get('pension_rate', profile.pension_rate) or 0.0)
    profile.insurance_deduction = float(request.form.get('insurance_deduction', profile.insurance_deduction) or 0.0)
    profile.other_deductions = float(request.form.get('other_deductions', profile.other_deductions) or 0.0)

    db.session.add(profile)
    db.session.commit()
    flash(f"Salary preferences updated with active currency {user.currency}!", "success")
    return redirect(url_for('dashboard'))

# -------------------------------------------------------------
# Analytics APIs for Charts
# -------------------------------------------------------------
@app.route('/api/personal-chart-data')
@login_required
def personal_chart_data():
    user = get_current_user()
    profile = user.profile
    if not profile:
        return jsonify({})

    calc = calculate_salary_breakdown(
        base_salary=profile.base_salary,
        frequency=profile.pay_frequency,
        allowances=profile.allowances,
        bonus_expected=profile.bonus_expected,
        tax_rate=profile.tax_rate,
        pension_rate=profile.pension_rate,
        insurance_deduction=profile.insurance_deduction,
        other_deductions=profile.other_deductions
    )

    records_list = SalaryRecord.query.filter_by(user_id=user.id).order_by(SalaryRecord.pay_date.asc()).all()
    history_labels = [r.pay_date.strftime('%b %Y') for r in records_list[-8:]]
    history_net = [r.net_amount for r in records_list[-8:]]
    history_gross = [r.gross_amount for r in records_list[-8:]]

    return jsonify({
        'calc': calc,
        'history': {
            'labels': history_labels,
            'net': history_net,
            'gross': history_gross
        }
    })

@app.route('/api/family-chart-data')
@login_required
def family_chart_data():
    user = get_current_user()
    if not user.family_id:
        return jsonify({})

    family = Family.query.get(user.family_id)
    labels = []
    net_values = []
    gross_values = []
    
    for m in family.members:
        p = m.profile
        if p:
            c = calculate_salary_breakdown(
                base_salary=p.base_salary,
                frequency=p.pay_frequency,
                allowances=p.allowances,
                bonus_expected=p.bonus_expected,
                tax_rate=p.tax_rate,
                pension_rate=p.pension_rate,
                insurance_deduction=p.insurance_deduction,
                other_deductions=p.other_deductions
            )
            labels.append(m.name)
            net_values.append(c['monthly']['net'])
            gross_values.append(c['monthly']['gross'])

    return jsonify({
        'labels': labels,
        'net_values': net_values,
        'gross_values': gross_values
    })

# -------------------------------------------------------------
# Onboarding Setup Wizard Routes
# -------------------------------------------------------------
@app.route('/onboarding/complete', methods=['POST'])
@login_required
def complete_onboarding():
    user = get_current_user()
    currency = request.form.get('currency', '₹').strip()
    job_title = request.form.get('job_title', user.job_title).strip()
    pay_frequency = request.form.get('pay_frequency', 'monthly')
    
    try:
        base_salary = float(request.form.get('base_salary', 75000.0) or 75000.0)
    except ValueError:
        base_salary = 75000.0
        
    try:
        allowances = float(request.form.get('allowances', 10000.0) or 0.0)
    except ValueError:
        allowances = 0.0
        
    try:
        tax_rate = float(request.form.get('tax_rate', 15.0) or 0.0)
    except ValueError:
        tax_rate = 15.0
        
    try:
        pension_rate = float(request.form.get('pension_rate', 6.0) or 0.0)
    except ValueError:
        pension_rate = 6.0

    user.currency = currency
    user.job_title = job_title
    user.is_onboarded = True

    # Update or create Salary Profile
    if not user.profile:
        user.profile = SalaryProfile(user_id=user.id)
    user.profile.pay_frequency = pay_frequency
    user.profile.base_salary = base_salary
    user.profile.allowances = allowances
    user.profile.tax_rate = tax_rate
    user.profile.pension_rate = pension_rate

    # Optional initial baseline expenses entered in wizard
    today = datetime.utcnow().date()
    exp_inputs = [
        ('groceries', 'exp_groceries', 'Baseline Monthly Groceries'),
        ('clothing', 'exp_clothing', 'Monthly Clothing & Apparel'),
        ('dining', 'exp_dining', 'Dining & Food Outflow'),
        ('utilities', 'exp_utilities', 'Utilities & Recurring Bills'),
        ('other', 'exp_other', 'Personal & Other Purchases')
    ]
    for cat, form_key, title in exp_inputs:
        val_str = request.form.get(form_key, '0').strip()
        try:
            amt = float(val_str or 0)
            if amt > 0:
                db.session.add(ExpenseRecord(
                    user_id=user.id,
                    category=cat,
                    title=title,
                    amount=amt,
                    cadence='monthly',
                    expense_date=today
                ))
        except ValueError:
            pass

    db.session.commit()
    flash(f"Welcome aboard! Your financial profile and baseline budgets have been calibrated in {currency}.", "success")
    return redirect(url_for('dashboard'))

@app.route('/onboarding/skip', methods=['POST'])
@login_required
def skip_onboarding():
    user = get_current_user()
    user.is_onboarded = True
    db.session.commit()
    flash("Setup completed with standard defaults. You can customize anytime via Quick Setup or Profile Settings.", "info")
    return redirect(url_for('dashboard'))

# -------------------------------------------------------------
# AI Financial Assistant Query Engine
# -------------------------------------------------------------
def generate_builtin_finance_insight(query, ctx):
    """Rule-based financial advisor fallback grounded in actual live user metrics."""
    q = query.lower()
    curr = ctx['currency']
    
    # 1. Affordability check (e.g., "can I afford 25000", "can I buy")
    import re
    amounts = re.findall(r'[\d,]+(?:\.\d+)?', query.replace(curr, '').replace(',', ''))
    if any(k in q for k in ['afford', 'can i buy', 'can i purchase', 'can i spend', 'cost']) and amounts:
        try:
            target_amt = float(amounts[0].replace(',', ''))
            monthly_savings = ctx['monthly_savings']
            if target_amt <= 0:
                pass
            elif target_amt <= monthly_savings:
                rem = monthly_savings - target_amt
                pct = (target_amt / monthly_savings) * 100
                return (
                    f"### ✅ Yes, you can comfortably afford this!\n\n"
                    f"- **Requested Purchase:** **{curr}{target_amt:,.2f}**\n"
                    f"- **Your Monthly Net Savings:** **{curr}{monthly_savings:,.2f}**\n"
                    f"- **Impact on Savings:** Takes about **{pct:.1f}%** of your monthly surplus.\n"
                    f"- **Remaining Surplus After Purchase:** **{curr}{rem:,.2f}**\n\n"
                    f"**Recommendation:** Because this is within your positive cash flow of {curr}{monthly_savings:,.2f}/month, you can make this purchase without going into deficit or touching emergency reserves."
                )
            else:
                deficit = target_amt - monthly_savings
                return (
                    f"### ⚠️ Caution: Exceeds Monthly Surplus\n\n"
                    f"- **Requested Purchase:** **{curr}{target_amt:,.2f}**\n"
                    f"- **Your Current Monthly Savings:** **{curr}{monthly_savings:,.2f}**\n"
                    f"- **Monthly Deficit:** **{curr}{deficit:,.2f}**\n\n"
                    f"**Recommendation:** Buying this in a single month would exceed your monthly free cash flow by {curr}{deficit:,.2f}. Consider saving for **{int(target_amt / max(monthly_savings, 1)) + 1} months** or allocating a dedicated sinking fund."
                )
        except Exception:
            pass

    # 2. Income / Take-Home Pay / Salary
    if any(k in q for k in ['take home', 'net salary', 'net pay', 'gross', 'income', 'salary', 'earn', 'how much do i make']):
        return (
            f"### 💰 Your Income & Take-Home Pay Summary\n\n"
            f"- **Role:** {ctx['job_title']}\n"
            f"- **Base Salary ({ctx['pay_frequency']}):** **{curr}{ctx['base_salary']:,.2f}**\n"
            f"- **Monthly Gross Income:** **{curr}{ctx['monthly_gross']:,.2f}**\n"
            f"- **Monthly Taxes & Deductions:** -{curr}{(ctx['monthly_tax'] + ctx['monthly_pension']):,.2f}\n"
            f"- **Monthly Net Take-Home Pay:** **{curr}{ctx['monthly_net']:,.2f}**\n"
            f"- **Annual Net Take-Home:** **{curr}{ctx['annual_net']:,.2f}** (Gross: {curr}{ctx['annual_gross']:,.2f})\n\n"
            f"**Takeaway:** For every 100 earned, you take home approximately **{(ctx['monthly_net'] / max(ctx['monthly_gross'], 1) * 100):.1f}%** after statutory deductions."
        )

    # 3. Expenses & Categories (Groceries, Clothes, Dining, Other)
    if any(k in q for k in ['groceries', 'grocery', 'clothes', 'clothing', 'dining', 'food', 'utilities', 'other', 'expenses', 'spending', 'spend']):
        cats = ctx['categories']
        return (
            f"### 🛒 Your Spending & Expense Breakdown\n\n"
            f"- **Total Monthly Outflow:** **{curr}{ctx['total_monthly_expenses']:,.2f}**\n"
            f"#### Itemized Categories:\n"
            f"- **Groceries:** {curr}{cats['groceries']:,.2f}\n"
            f"- **Clothing & Apparel:** {curr}{cats['clothing']:,.2f}\n"
            f"- **Dining & Restaurants:** {curr}{cats['dining']:,.2f}\n"
            f"- **Utilities & Bills:** {curr}{cats['utilities']:,.2f}\n"
            f"- **Housing:** {curr}{cats['housing']:,.2f}\n"
            f"- **Transportation:** {curr}{cats['transportation']:,.2f}\n"
            f"- **Healthcare:** {curr}{cats['healthcare']:,.2f}\n"
            f"- **Other Purchases:** {curr}{cats['other']:,.2f}\n\n"
            f"**Expense Load:** Your living costs consume **{100 - ctx['savings_rate_pct']:.1f}%** of your monthly net income."
        )

    # 4. Savings & Savings Rate
    if any(k in q for k in ['save', 'saving', 'savings', 'rate', 'invest', 'emergency']):
        status = "🌟 Exceptional" if ctx['savings_rate_pct'] >= 30 else ("👍 Healthy" if ctx['savings_rate_pct'] >= 20 else "⚠️ Room for Growth")
        return (
            f"### 📈 Your Savings Analysis ({status})\n\n"
            f"- **Monthly Net Income:** {curr}{ctx['monthly_net']:,.2f}\n"
            f"- **Monthly Expenses:** -{curr}{ctx['total_monthly_expenses']:,.2f}\n"
            f"- **Net Monthly Savings:** **{curr}{ctx['monthly_savings']:,.2f}**\n"
            f"- **Current Savings Rate:** **{ctx['savings_rate_pct']}%**\n\n"
            f"#### 50/30/20 Benchmark Guideline:\n"
            f"- **Needs (≤50%):** Essential housing, groceries, utilities.\n"
            f"- **Wants (≤30%):** Dining, clothing, entertainment.\n"
            f"- **Savings (≥20%):** You are currently saving **{ctx['savings_rate_pct']}%** of your take-home pay.\n"
            f"**Recommendation:** Maintain a 3-6 month emergency fund ({curr}{(ctx['total_monthly_expenses'] * 4):,.2f}) in liquid savings."
        )

    # 5. Taxes & Deductions
    if any(k in q for k in ['tax', 'taxes', 'pf', 'pension', 'deduct', 'deduction', 'epf', '401k']):
        return (
            f"### ⚖️ Your Tax & Statutory Deductions\n\n"
            f"- **Monthly Tax Withheld:** **{curr}{ctx['monthly_tax']:,.2f}**\n"
            f"- **Monthly Pension / PF / Retirement:** **{curr}{ctx['monthly_pension']:,.2f}**\n"
            f"- **Annual Projected Tax Outflow:** **{curr}{ctx['annual_tax']:,.2f}**\n\n"
            f"**Tip:** Verify local tax deductions (such as Section 80C/NPS in India or 401(k)/IRA contributions) to legally reduce tax liability."
        )

    # Default Comprehensive Diagnostic
    return (
        f"### 📊 Financial Health Diagnostic for {ctx['user_name']}\n\n"
        f"Here is your real-time financial standing in **{curr}**:\n\n"
        f"- **Net Take-Home Pay:** **{curr}{ctx['monthly_net']:,.2f}** / month\n"
        f"- **Living Expenses:** **{curr}{ctx['total_monthly_expenses']:,.2f}** / month\n"
        f"- **Net Surplus / Savings:** **{curr}{ctx['monthly_savings']:,.2f}** / month (**{ctx['savings_rate_pct']}%**)\n"
        f"- **Annual Net Run-Rate:** **{curr}{ctx['annual_net']:,.2f}**\n\n"
        f"**Ask me any specific query!** Examples:\n"
        f"- *'Can I afford a {curr}30,000 laptop?'*\n"
        f"- *'How much am I spending on groceries vs dining?'*\n"
        f"- *'How can I increase my monthly savings?'*"
    )

@app.route('/api/ai-finance-query', methods=['POST'])
@login_required
def ai_finance_query():
    user = get_current_user()
    data = request.get_json() or {}
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'error': 'Please provide a question about your revenue, taxes, or expenses.'}), 400

    profile = user.profile
    calc = calculate_salary_breakdown(
        base_salary=profile.base_salary if profile else 75000.0,
        frequency=profile.pay_frequency if profile else 'monthly',
        allowances=profile.allowances if profile else 0.0,
        bonus_expected=profile.bonus_expected if profile else 0.0,
        tax_rate=profile.tax_rate if profile else 15.0,
        pension_rate=profile.pension_rate if profile else 6.0,
        insurance_deduction=profile.insurance_deduction if profile else 0.0,
        other_deductions=profile.other_deductions if profile else 0.0
    )
    
    expenses_list = ExpenseRecord.query.filter_by(user_id=user.id).all()
    exp_summary = calculate_expense_summary(expenses_list, calc['monthly']['net'])
    currency = user.currency or '₹'

    fin_context = {
        'user_name': user.name,
        'job_title': user.job_title,
        'currency': currency,
        'base_salary': profile.base_salary if profile else 0.0,
        'pay_frequency': profile.pay_frequency if profile else 'monthly',
        'monthly_gross': calc['monthly']['gross'],
        'monthly_net': calc['monthly']['net'],
        'monthly_tax': calc['monthly']['tax'],
        'monthly_pension': calc['monthly']['pension'],
        'annual_gross': calc['annual']['gross'],
        'annual_net': calc['annual']['net'],
        'annual_tax': calc['annual']['tax'],
        'total_monthly_expenses': exp_summary['total_monthly'],
        'monthly_savings': exp_summary['monthly_savings'],
        'savings_rate_pct': exp_summary['savings_rate'],
        'categories': exp_summary['categories']
    }

    # If GEMINI_API_KEY is configured in environment, use generative AI
    gemini_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if gemini_key:
        try:
            import urllib.request
            import json as pyjson
            
            prompt = f"""
You are RevTrack AI, an elite, highly encouraging, and mathematically accurate personal finance advisor.
Answer the user's question directly and concisely based strictly on their actual financial metrics below.
Format your answer with markdown bolding, clear bullet points, and actionable financial steps.
Use their active currency: {currency}.

User Financial Metrics:
- Name: {fin_context['user_name']} ({fin_context['job_title']})
- Currency: {currency}
- Base Salary: {currency}{fin_context['base_salary']:,.2f} ({fin_context['pay_frequency']})
- Monthly Gross Income: {currency}{fin_context['monthly_gross']:,.2f}
- Monthly Net Take-Home Pay: {currency}{fin_context['monthly_net']:,.2f}
- Monthly Tax Deductions: {currency}{fin_context['monthly_tax']:,.2f}
- Monthly Pension / PF: {currency}{fin_context['monthly_pension']:,.2f}
- Annual Gross: {currency}{fin_context['annual_gross']:,.2f} | Annual Net: {currency}{fin_context['annual_net']:,.2f}
- Annual Tax: {currency}{fin_context['annual_tax']:,.2f}
- Monthly Outflow (Total Expenses): {currency}{fin_context['total_monthly_expenses']:,.2f}
- Monthly Savings Surplus: {currency}{fin_context['monthly_savings']:,.2f} ({fin_context['savings_rate_pct']}% savings rate)
- Category Expenses:
  * Groceries: {currency}{fin_context['categories']['groceries']:,.2f}
  * Clothing: {currency}{fin_context['categories']['clothing']:,.2f}
  * Dining: {currency}{fin_context['categories']['dining']:,.2f}
  * Utilities: {currency}{fin_context['categories']['utilities']:,.2f}
  * Housing: {currency}{fin_context['categories']['housing']:,.2f}
  * Transportation: {currency}{fin_context['categories']['transportation']:,.2f}
  * Healthcare: {currency}{fin_context['categories']['healthcare']:,.2f}
  * Other Purchases: {currency}{fin_context['categories']['other']:,.2f}

User Question: "{query}"
"""
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 600}
            }
            req = urllib.request.Request(
                api_url,
                data=pyjson.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                result = pyjson.loads(response.read().decode('utf-8'))
                ai_text = result['candidates'][0]['content']['parts'][0]['text']
                return jsonify({'reply': ai_text, 'powered_by': 'Gemini AI'})
        except Exception as e:
            pass

    # Built-in intelligent engine fallback
    reply = generate_builtin_finance_insight(query, fin_context)
    return jsonify({'reply': reply, 'powered_by': 'RevTrack Finance Engine'})

# Health Check Route for Render Free Tier Heartbeat
@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
