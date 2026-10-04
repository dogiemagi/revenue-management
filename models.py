import secrets
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Family(db.Model):
    __tablename__ = 'families'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    invite_code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    created_by_id = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    members = db.relationship('User', backref='family', lazy=True)
    
    @staticmethod
    def generate_invite_code():
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        code = ''.join(secrets.choice(chars) for _ in range(8))
        return f"{code[:4]}-{code[4:]}"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'invite_code': self.invite_code,
            'created_at': self.created_at.strftime('%Y-%m-%d'),
            'members_count': len(self.members)
        }


class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    job_title = db.Column(db.String(100), default='Professional')
    currency = db.Column(db.String(5), default='$')
    
    family_id = db.Column(db.Integer, db.ForeignKey('families.id', ondelete='SET NULL'), nullable=True)
    is_family_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    profile = db.relationship('SalaryProfile', backref='user', uselist=False, cascade='all, delete-orphan')
    salary_records = db.relationship('SalaryRecord', backref='user', lazy=True, cascade='all, delete-orphan', order_by='SalaryRecord.pay_date.desc()')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
        
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'job_title': self.job_title,
            'currency': self.currency,
            'family_id': self.family_id,
            'is_family_admin': self.is_family_admin,
            'created_at': self.created_at.strftime('%Y-%m-%d')
        }


class SalaryProfile(db.Model):
    __tablename__ = 'salary_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    
    # Frequency: 'weekly', 'biweekly', 'monthly', 'yearly'
    pay_frequency = db.Column(db.String(20), default='monthly')
    base_salary = db.Column(db.Float, default=5000.0)
    allowances = db.Column(db.Float, default=500.0)       # Housing, Transport, etc.
    bonus_expected = db.Column(db.Float, default=200.0)   # Monthly average bonus
    
    tax_rate = db.Column(db.Float, default=15.0)          # Tax percentage %
    pension_rate = db.Column(db.Float, default=5.0)       # 401k / PF / Retirement %
    insurance_deduction = db.Column(db.Float, default=150.0) # Flat per pay period
    other_deductions = db.Column(db.Float, default=50.0)     # Union, perks, etc.
    
    standard_hours_per_week = db.Column(db.Float, default=40.0)
    overtime_rate_multiplier = db.Column(db.Float, default=1.5)
    
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'pay_frequency': self.pay_frequency,
            'base_salary': self.base_salary,
            'allowances': self.allowances,
            'bonus_expected': self.bonus_expected,
            'tax_rate': self.tax_rate,
            'pension_rate': self.pension_rate,
            'insurance_deduction': self.insurance_deduction,
            'other_deductions': self.other_deductions,
            'standard_hours_per_week': self.standard_hours_per_week,
            'overtime_rate_multiplier': self.overtime_rate_multiplier
        }


class SalaryRecord(db.Model):
    __tablename__ = 'salary_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    title = db.Column(db.String(120), nullable=False)
    pay_date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    frequency = db.Column(db.String(20), default='monthly') # 'weekly', 'biweekly', 'monthly', 'yearly', 'bonus'
    category = db.Column(db.String(50), default='primary_job') # 'primary_job', 'side_hustle', 'bonus', 'freelance'
    
    gross_amount = db.Column(db.Float, nullable=False, default=0.0)
    allowances = db.Column(db.Float, default=0.0)
    tax_deduction = db.Column(db.Float, default=0.0)
    pension_deduction = db.Column(db.Float, default=0.0)
    insurance_deduction = db.Column(db.Float, default=0.0)
    other_deductions = db.Column(db.Float, default=0.0)
    net_amount = db.Column(db.Float, nullable=False, default=0.0)
    
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'pay_date': self.pay_date.strftime('%Y-%m-%d'),
            'frequency': self.frequency,
            'category': self.category,
            'gross_amount': round(self.gross_amount, 2),
            'allowances': round(self.allowances, 2),
            'tax_deduction': round(self.tax_deduction, 2),
            'pension_deduction': round(self.pension_deduction, 2),
            'insurance_deduction': round(self.insurance_deduction, 2),
            'other_deductions': round(self.other_deductions, 2),
            'net_amount': round(self.net_amount, 2),
            'total_deductions': round(self.tax_deduction + self.pension_deduction + self.insurance_deduction + self.other_deductions, 2),
            'notes': self.notes or ''
        }
