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
from models import db, User, Family, SalaryProfile, SalaryRecord
from calculator import calculate_salary_breakdown, normalize_to_annual
from demo_data import seed_demo_data

app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

# Ensure database tables exist upon start
with app.app_context():
    db.create_all()

# -------------------------------------------------------------
# Authentication & Access Decorators
# -------------------------------------------------------------
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please sign in to access your revenue dashboard.", "warning")
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
    return {
        'current_user': current_user,
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
        currency = request.form.get('currency', '$').strip()
        account_type = request.form.get('account_type', 'personal') # 'personal', 'create_family', 'join_family'
        
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
            currency=currency
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

        # Initialize Default Salary Profile
        profile = SalaryProfile(
            user_id=user.id,
            pay_frequency="monthly",
            base_salary=5000.0,
            allowances=500.0,
            bonus_expected=0.0,
            tax_rate=15.0,
            pension_rate=5.0,
            insurance_deduction=150.0,
            other_deductions=50.0
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
        flash("Logged into Demo Account (Morgan Household) with live sample data!", "success")
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

    # Calculate current user's profile breakdown
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
        recent_records=recent_records,
        total_earned_history=round(total_earned_history, 2),
        total_tax_paid_history=round(total_tax_paid_history, 2)
    )

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
        'base_salary': 5000.0,
        'frequency': 'monthly',
        'allowances': 500.0,
        'bonus': 0.0,
        'tax_rate': 15.0,
        'pension_rate': 5.0,
        'insurance': 150.0,
        'other': 50.0,
        'currency': '$'
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
    
    base_salary = float(data.get('base_salary', 5000.0) or 0.0)
    frequency = data.get('frequency', 'monthly')
    allowances = float(data.get('allowances', 0.0) or 0.0)
    bonus = float(data.get('bonus', 0.0) or 0.0)
    tax_rate = float(data.get('tax_rate', 15.0) or 0.0)
    pension_rate = float(data.get('pension_rate', 5.0) or 0.0)
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
    flash("Salary settings and preferences updated!", "success")
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

    # Monthly Net History from records
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

# Health Check Route for Render Free Tier Heartbeat
@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()}), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
