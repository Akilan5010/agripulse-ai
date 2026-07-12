from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='farmer', nullable=False) # 'farmer' or 'admin'
    full_name = db.Column(db.String(120), nullable=True)
    contact = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    recommendations = db.relationship('Recommendation', backref='user', lazy=True, cascade="all, delete-orphan")
    soil_records = db.relationship('SoilRecord', backref='user', lazy=True, cascade="all, delete-orphan")
    weather_records = db.relationship('WeatherRecord', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'full_name': self.full_name,
            'contact': self.contact,
            'location': self.location,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class SoilRecord(db.Model):
    __tablename__ = 'soil_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    soil_type = db.Column(db.String(50), nullable=False)
    pH = db.Column(db.Float, nullable=False)
    N = db.Column(db.Float, nullable=False) # Nitrogen
    P = db.Column(db.Float, nullable=False) # Phosphorus
    K = db.Column(db.Float, nullable=False) # Potassium
    moisture = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'soil_type': self.soil_type,
            'pH': self.pH,
            'N': self.N,
            'P': self.P,
            'K': self.K,
            'moisture': self.moisture,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None
        }

class WeatherRecord(db.Model):
    __tablename__ = 'weather_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    rainfall = db.Column(db.Float, nullable=False)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'rainfall': self.rainfall,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None
        }

class Recommendation(db.Model):
    __tablename__ = 'recommendations'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    soil_record_id = db.Column(db.Integer, db.ForeignKey('soil_records.id', ondelete='CASCADE'), nullable=False)
    weather_record_id = db.Column(db.Integer, db.ForeignKey('weather_records.id', ondelete='CASCADE'), nullable=False)
    recommended_crop = db.Column(db.String(80), nullable=False)
    fertilizer_name = db.Column(db.String(120), nullable=False)
    fertilizer_qty = db.Column(db.String(120), nullable=False) # e.g. "50 kg/acre"
    fertilizer_schedule = db.Column(db.Text, nullable=False) # e.g. "Apply 50% at sowing, 50% after 30 days"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships to access details directly
    soil_record = db.relationship('SoilRecord', backref='recommendation', lazy=True)
    weather_record = db.relationship('WeatherRecord', backref='recommendation', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'soil_record': self.soil_record.to_dict() if self.soil_record else None,
            'weather_record': self.weather_record.to_dict() if self.weather_record else None,
            'recommended_crop': self.recommended_crop,
            'fertilizer_name': self.fertilizer_name,
            'fertilizer_qty': self.fertilizer_qty,
            'fertilizer_schedule': self.fertilizer_schedule,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class CropInfo(db.Model):
    __tablename__ = 'crop_info'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False)
    growing_season = db.Column(db.String(80), nullable=False) # e.g. "Kharif (Monsoon)"
    water_requirement = db.Column(db.String(120), nullable=False) # e.g. "High (1200-1500 mm)"
    expected_yield = db.Column(db.String(120), nullable=False) # e.g. "3.5 - 4.5 tons/acre"
    harvest_duration = db.Column(db.String(80), nullable=False) # e.g. "120-150 days"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'growing_season': self.growing_season,
            'water_requirement': self.water_requirement,
            'expected_yield': self.expected_yield,
            'harvest_duration': self.harvest_duration,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
