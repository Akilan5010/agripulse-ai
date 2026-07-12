import os
import json
from flask import Flask, request, jsonify, session, render_template, send_file
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

from config import Config
from models import db, User, SoilRecord, WeatherRecord, Recommendation, CropInfo
from ml.trainer import train_model, predict_crop, CROP_BASELINES

# Load env vars
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# Initialize Database
db.init_app(app)

# Helper function for session check
def get_current_user():
    if 'user_id' not in session:
        return None
    return User.query.get(session['user_id'])

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Unauthorized. Please login.'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user or user.role != 'admin':
            return jsonify({'error': 'Forbidden. Admin privileges required.'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Crop info database seeding
def seed_crop_database():
    crops_to_seed = {
        'Rice': {
            'description': 'Rice is the primary staple food crop for a large part of the world. It thrives in hot, humid climates and clayey soils that can hold water.',
            'growing_season': 'Kharif (Monsoon)',
            'water_requirement': 'Very High (1200-1500 mm)',
            'expected_yield': '2.0 - 2.5 tons/acre',
            'harvest_duration': '120-140 days'
        },
        'Maize': {
            'description': 'Maize (Corn) is a versatile cereal crop grown under diverse climatic conditions. It requires well-drained loamy soils and warm weather.',
            'growing_season': 'Kharif / Spring',
            'water_requirement': 'Moderate (500-800 mm)',
            'expected_yield': '2.5 - 3.5 tons/acre',
            'harvest_duration': '90-110 days'
        },
        'Cotton': {
            'description': 'Cotton is a major fiber cash crop. It requires a long frost-free period, warm temperatures, and moderate rainfall, growing best in deep black cotton soils.',
            'growing_season': 'Kharif (Monsoon)',
            'water_requirement': 'Moderate (700-1000 mm)',
            'expected_yield': '0.8 - 1.2 tons/acre',
            'harvest_duration': '160-180 days'
        },
        'Wheat': {
            'description': 'Wheat is a crucial cool-season cereal grain. It requires a cool growing climate and a warm, dry ripening season, thriving in rich loamy soils.',
            'growing_season': 'Rabi (Winter)',
            'water_requirement': 'Low to Moderate (400-600 mm)',
            'expected_yield': '1.8 - 2.2 tons/acre',
            'harvest_duration': '110-130 days'
        },
        'Chickpea': {
            'description': 'Chickpea (Gram) is an important pulse crop rich in protein. It fixates nitrogen into the soil and requires cool, dry climates with light-to-medium soils.',
            'growing_season': 'Rabi (Winter)',
            'water_requirement': 'Low (250-400 mm)',
            'expected_yield': '0.6 - 0.8 tons/acre',
            'harvest_duration': '100-120 days'
        },
        'Kidneybeans': {
            'description': 'Kidneybeans (Rajma) are pulse crops highly prized for protein. They require moderate temperatures and well-aerated soils, being highly sensitive to frost and waterlogging.',
            'growing_season': 'Rabi / Summer',
            'water_requirement': 'Moderate (500-700 mm)',
            'expected_yield': '0.5 - 0.7 tons/acre',
            'harvest_duration': '90-100 days'
        },
        'Mango': {
            'description': 'Mango is a tropical fruit tree. It thrives in warm tropical climates with dry periods for flowering and fruiting, in deep loamy alluvial soils.',
            'growing_season': 'Annual (Harvest in Summer)',
            'water_requirement': 'Moderate (1000-1500 mm)',
            'expected_yield': '4.0 - 6.0 tons/acre (Mature)',
            'harvest_duration': '3-5 years to bear fruit, 120 days from flowering'
        },
        'Banana': {
            'description': 'Banana is a high-yield tropical plant. It requires high humidity, persistent warmth, and rich, organic, well-drained soils with frequent watering.',
            'growing_season': 'Perennial (Year-round)',
            'water_requirement': 'High (1500-2200 mm)',
            'expected_yield': '12.0 - 15.0 tons/acre',
            'harvest_duration': '300-360 days'
        },
        'Orange': {
            'description': 'Orange is a sweet citrus crop. It requires a warm climate with ample sunlight and prefers well-drained sandy-loam soils with moderate organic matter.',
            'growing_season': 'Annual (Harvest in Winter)',
            'water_requirement': 'Moderate to High (900-1200 mm)',
            'expected_yield': '8.0 - 10.0 tons/acre',
            'harvest_duration': '3-4 years to bear fruit, 200 days from flowering'
        },
        'Coconut': {
            'description': 'Coconut palm is a coastal tree that requires high relative humidity, warmth, high saline tolerance, and sandy soils with good water drainage.',
            'growing_season': 'Perennial',
            'water_requirement': 'High (1300-2000 mm)',
            'expected_yield': '4,000 - 6,000 nuts/acre annually',
            'harvest_duration': '5-7 years to bear, continuous harvest'
        },
        'Coffee': {
            'description': 'Coffee is an acid-loving shade crop. It grows at high altitudes with moderate temperature, rich volcanic soil, and evenly distributed rainfall.',
            'growing_season': 'Perennial',
            'water_requirement': 'High (1200-1800 mm)',
            'expected_yield': '0.6 - 0.9 tons/acre',
            'harvest_duration': '3-4 years to bear fruit, 220 days from flowering'
        }
    }
    
    existing = CropInfo.query.all()
    if not existing:
        for name, details in crops_to_seed.items():
            crop = CropInfo(
                name=name,
                description=details['description'],
                growing_season=details['growing_season'],
                water_requirement=details['water_requirement'],
                expected_yield=details['expected_yield'],
                harvest_duration=details['harvest_duration']
            )
            db.session.add(crop)
        db.session.commit()
        print("Crop database seeded successfully.")

def check_and_train_model():
    """Ensure ML model files exist on startup; if not, train immediately."""
    if (not os.path.exists(app.config['MODEL_PATH']) or 
        not os.path.exists(app.config['SCALER_PATH']) or
        not os.path.exists(app.config['METRICS_PATH'])):
        print("ML model files not found. Initiating training...")
        train_model(
            app.config['DATASET_PATH'],
            app.config['MODEL_PATH'],
            app.config['SCALER_PATH'],
            app.config['METRICS_PATH']
        )
    else:
        print("ML model files found.")

# Server Routes
@app.route('/')
def index():
    return render_template('index.html')

# --- Authentication APIs ---

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    full_name = data.get('full_name')
    contact = data.get('contact')
    location = data.get('location')
    role = data.get('role', 'farmer') # default to farmer, admin can register admins or set role
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400
        
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists.'}), 400
        
    user = User(
        username=username,
        role=role,
        full_name=full_name,
        contact=contact,
        location=location
    )
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': 'Registration successful. Please login.', 'user': user.to_dict()}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400
        
    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid username or password.'}), 401
        
    session['user_id'] = user.id
    session['role'] = user.role
    
    return jsonify({'message': 'Login successful.', 'user': user.to_dict()})

@app.route('/api/auth/profile', methods=['GET', 'PUT'])
@login_required
def profile():
    user = get_current_user()
    if request.method == 'GET':
        return jsonify({'user': user.to_dict()})
        
    elif request.method == 'PUT':
        data = request.get_json() or {}
        user.full_name = data.get('full_name', user.full_name)
        user.contact = data.get('contact', user.contact)
        user.location = data.get('location', user.location)
        
        if data.get('password'):
            user.set_password(data.get('password'))
            
        db.session.commit()
        return jsonify({'message': 'Profile updated successfully.', 'user': user.to_dict()})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('role', None)
    return jsonify({'message': 'Logged out successfully.'})

# --- Recommendation Engine APIs ---

@app.route('/api/recommend', methods=['POST'])
@login_required
def recommend():
    user = get_current_user()
    data = request.get_json() or {}
    
    try:
        soil_type = data.get('soil_type')
        pH = float(data.get('pH'))
        N = float(data.get('N'))
        P = float(data.get('P'))
        K = float(data.get('K'))
        moisture = float(data.get('moisture'))
        
        temperature = float(data.get('temperature'))
        humidity = float(data.get('humidity'))
        rainfall = float(data.get('rainfall'))
    except (TypeError, ValueError) as e:
        return jsonify({'error': f'Invalid input format: {str(e)}'}), 400
        
    # 1. Run Machine Learning Crop Recommendation
    try:
        predicted_crop, confidence = predict_crop(
            N, P, K, temperature, humidity, pH, rainfall,
            app.config['MODEL_PATH'], app.config['SCALER_PATH']
        )
    except Exception as e:
        return jsonify({'error': f'ML model prediction failed: {str(e)}'}), 500
        
    # 2. Dynamic Fertilizer Recommendation Engine
    # Get crop baseline targets
    baseline = CROP_BASELINES.get(predicted_crop, {'N': (80, 120), 'P': (35, 60), 'K': (30, 50)})
    ideal_N = (baseline['N'][0] + baseline['N'][1]) / 2.0
    ideal_P = (baseline['P'][0] + baseline['P'][1]) / 2.0
    ideal_K = (baseline['K'][0] + baseline['K'][1]) / 2.0
    
    fertilizer_recs = []
    qty_recs = []
    schedule_recs = []
    
    n_diff = ideal_N - N
    p_diff = ideal_P - P
    k_diff = ideal_K - K
    
    if n_diff > 10:
        urea_qty = round(n_diff * 2.17, 1) # Urea has 46% N
        fertilizer_recs.append("Urea")
        qty_recs.append(f"{urea_qty} kg/acre")
        schedule_recs.append("Apply Urea: 50% basal dose during transplanting/sowing, and 50% top-dressed in two splits at 30 and 60 days.")
        
    if p_diff > 5:
        ssp_qty = round(p_diff * 6.25, 1) # Single Superphosphate has 16% P2O5
        fertilizer_recs.append("Single Superphosphate (SSP)")
        qty_recs.append(f"{ssp_qty} kg/acre")
        schedule_recs.append("Apply SSP: 100% basal dose during soil preparation near root zones.")
        
    if k_diff > 5:
        mop_qty = round(k_diff * 1.67, 1) # Muriate of Potash has 60% K2O
        fertilizer_recs.append("Muriate of Potash (MOP)")
        qty_recs.append(f"{mop_qty} kg/acre")
        schedule_recs.append("Apply MOP: 50% as basal dose and 50% top-dressed during flowering stage.")
        
    if not fertilizer_recs:
        fertilizer_name = "None Required"
        fertilizer_qty = "0 kg/acre"
        fertilizer_schedule = "Soil nutrients are fully sufficient. Maintain organic manure compost (5 tons/acre) annually."
    else:
        fertilizer_name = " + ".join(fertilizer_recs)
        fertilizer_qty = " + ".join(qty_recs)
        fertilizer_schedule = "\n".join(schedule_recs)
        
    # 3. Store Records in Database
    soil_rec = SoilRecord(
        user_id=user.id,
        soil_type=soil_type,
        pH=pH,
        N=N,
        P=P,
        K=K,
        moisture=moisture
    )
    weather_rec = WeatherRecord(
        user_id=user.id,
        temperature=temperature,
        humidity=humidity,
        rainfall=rainfall
    )
    
    db.session.add(soil_rec)
    db.session.add(weather_rec)
    db.session.flush() # Flush to populate IDs
    
    recommendation = Recommendation(
        user_id=user.id,
        soil_record_id=soil_rec.id,
        weather_record_id=weather_rec.id,
        recommended_crop=predicted_crop,
        fertilizer_name=fertilizer_name,
        fertilizer_qty=fertilizer_qty,
        fertilizer_schedule=fertilizer_schedule
    )
    
    db.session.add(recommendation)
    db.session.commit()
    
    # 4. Fetch crop details from encyclopedia
    crop_info = CropInfo.query.filter_by(name=predicted_crop).first()
    crop_info_dict = crop_info.to_dict() if crop_info else {
        'name': predicted_crop,
        'description': 'Crop information details are currently being cataloged by the administrator.',
        'growing_season': 'N/A',
        'water_requirement': 'N/A',
        'expected_yield': 'N/A',
        'harvest_duration': 'N/A'
    }
    
    return jsonify({
        'crop': predicted_crop,
        'confidence': confidence,
        'fertilizer': {
            'name': fertilizer_name,
            'quantity': fertilizer_qty,
            'schedule': fertilizer_schedule
        },
        'crop_details': crop_info_dict,
        'recommendation_id': recommendation.id
    })

# --- Crop Information APIs ---

@app.route('/api/crops', methods=['GET'])
def get_crops():
    crops = CropInfo.query.all()
    return jsonify([c.to_dict() for c in crops])

@app.route('/api/crops', methods=['POST'])
@admin_required
def add_crop():
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Crop name is required.'}), 400
        
    if CropInfo.query.filter_by(name=name).first():
        return jsonify({'error': f'Crop "{name}" already exists.'}), 400
        
    crop = CropInfo(
        name=name,
        description=data.get('description', ''),
        growing_season=data.get('growing_season', ''),
        water_requirement=data.get('water_requirement', ''),
        expected_yield=data.get('expected_yield', ''),
        harvest_duration=data.get('harvest_duration', '')
    )
    db.session.add(crop)
    db.session.commit()
    return jsonify({'message': 'Crop added successfully.', 'crop': crop.to_dict()}), 201

@app.route('/api/crops/<int:crop_id>', methods=['PUT', 'DELETE'])
@admin_required
def modify_crop(crop_id):
    crop = CropInfo.query.get_or_404(crop_id)
    
    if request.method == 'PUT':
        data = request.get_json() or {}
        crop.description = data.get('description', crop.description)
        crop.growing_season = data.get('growing_season', crop.growing_season)
        crop.water_requirement = data.get('water_requirement', crop.water_requirement)
        crop.expected_yield = data.get('expected_yield', crop.expected_yield)
        crop.harvest_duration = data.get('harvest_duration', crop.harvest_duration)
        db.session.commit()
        return jsonify({'message': 'Crop updated successfully.', 'crop': crop.to_dict()})
        
    elif request.method == 'DELETE':
        db.session.delete(crop)
        db.session.commit()
        return jsonify({'message': 'Crop deleted successfully.'})

# --- Dashboard & Reports APIs ---

@app.route('/api/dashboard/summary', methods=['GET'])
@login_required
def get_dashboard_summary():
    user = get_current_user()
    recs = Recommendation.query.filter_by(user_id=user.id).order_by(Recommendation.created_at.desc()).all()
    
    total_predictions = len(recs)
    crop_counts = {}
    for r in recs:
        crop_counts[r.recommended_crop] = crop_counts.get(r.recommended_crop, 0) + 1
        
    top_crop = max(crop_counts, key=crop_counts.get) if crop_counts else "None"
    
    # Get latest records for widgets
    latest_soil = SoilRecord.query.filter_by(user_id=user.id).order_by(SoilRecord.recorded_at.desc()).first()
    latest_weather = WeatherRecord.query.filter_by(user_id=user.id).order_by(WeatherRecord.recorded_at.desc()).first()
    
    return jsonify({
        'total_predictions': total_predictions,
        'top_recommended_crop': top_crop,
        'latest_soil': latest_soil.to_dict() if latest_soil else None,
        'latest_weather': latest_weather.to_dict() if latest_weather else None,
        'crop_distribution': crop_counts
    })

@app.route('/api/dashboard/history', methods=['GET'])
@login_required
def get_history():
    user = get_current_user()
    recs = Recommendation.query.filter_by(user_id=user.id).order_by(Recommendation.created_at.desc()).all()
    return jsonify([r.to_dict() for r in recs])

# --- Admin APIs ---

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])

@app.route('/api/admin/users/<int:user_id>/role', methods=['PUT'])
@admin_required
def update_user_role(user_id):
    data = request.get_json() or {}
    new_role = data.get('role')
    if new_role not in ['farmer', 'admin']:
        return jsonify({'error': 'Invalid role.'}), 400
        
    user = User.query.get_or_404(user_id)
    if user.id == session['user_id'] and new_role != 'admin':
        return jsonify({'error': 'You cannot demote yourself.'}), 400
        
    user.role = new_role
    db.session.commit()
    return jsonify({'message': f'User role updated to {new_role}.', 'user': user.to_dict()})

@app.route('/api/admin/model-stats', methods=['GET'])
@admin_required
def get_model_stats():
    if os.path.exists(app.config['METRICS_PATH']):
        with open(app.config['METRICS_PATH'], 'r') as f:
            metrics = json.load(f)
        return jsonify(metrics)
    return jsonify({'error': 'Model metrics not found.'}), 404

@app.route('/api/admin/retrain', methods=['POST'])
@admin_required
def trigger_retrain():
    try:
        model, scaler, metrics = train_model(
            app.config['DATASET_PATH'],
            app.config['MODEL_PATH'],
            app.config['SCALER_PATH'],
            app.config['METRICS_PATH']
        )
        return jsonify({'message': 'Model retrained successfully.', 'metrics': metrics})
    except Exception as e:
        return jsonify({'error': f'Retraining failed: {str(e)}'}), 500

@app.route('/api/admin/system-report', methods=['GET'])
@admin_required
def get_system_report():
    total_users = User.query.count()
    total_farmers = User.query.filter_by(role='farmer').count()
    total_admins = User.query.filter_by(role='admin').count()
    total_recs = Recommendation.query.count()
    total_soils = SoilRecord.query.count()
    total_weathers = WeatherRecord.query.count()
    
    # Get general crop counts in recommendations
    all_recs = Recommendation.query.all()
    crop_counts = {}
    for r in all_recs:
        crop_counts[r.recommended_crop] = crop_counts.get(r.recommended_crop, 0) + 1
        
    # Get last 10 recommendation audits
    recent_audits = Recommendation.query.order_by(Recommendation.created_at.desc()).limit(10).all()
    audits_list = []
    for r in recent_audits:
        audits_list.append({
            'id': r.id,
            'username': r.user.username,
            'crop': r.recommended_crop,
            'date': r.created_at.isoformat()
        })
        
    return jsonify({
        'users': {'total': total_users, 'farmers': total_farmers, 'admins': total_admins},
        'data_counts': {'recommendations': total_recs, 'soil_records': total_soils, 'weather_records': total_weathers},
        'crop_stats': crop_counts,
        'recent_audits': audits_list
    })

@app.route('/api/admin/dataset/download', methods=['GET'])
@admin_required
def download_dataset():
    try:
        return send_file(app.config['DATASET_PATH'], as_attachment=True, download_name='crop_recommendation_data.csv', mimetype='text/csv')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/dataset/upload', methods=['POST'])
@admin_required
def upload_dataset():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are allowed.'}), 400
    
    try:
        import pandas as pd
        df = pd.read_csv(file)
        required_cols = {'N', 'P', 'K', 'temp', 'humidity', 'pH', 'rainfall', 'label'}
        if not required_cols.issubset(df.columns):
            return jsonify({'error': f'Invalid CSV format. Must contain columns: {", ".join(required_cols)}'}), 400
        
        df.to_csv(app.config['DATASET_PATH'], index=False)
        return jsonify({'message': 'Dataset uploaded and validated successfully. You can now retrain the model.'})
    except Exception as e:
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500

@app.route('/api/admin/dataset/add-row', methods=['POST'])
@admin_required
def add_dataset_row():
    data = request.get_json() or {}
    try:
        N = float(data.get('N'))
        P = float(data.get('P'))
        K = float(data.get('K'))
        temp = float(data.get('temp'))
        humidity = float(data.get('humidity'))
        pH = float(data.get('pH'))
        rainfall = float(data.get('rainfall'))
        label = str(data.get('label')).strip()
        
        if not label:
            return jsonify({'error': 'Crop label is required.'}), 400
    except (TypeError, ValueError) as e:
        return jsonify({'error': f'Invalid input format: {str(e)}'}), 400
        
    try:
        import csv
        file_exists = os.path.exists(app.config['DATASET_PATH'])
        with open(app.config['DATASET_PATH'], mode='a', newline='') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(['N', 'P', 'K', 'temp', 'humidity', 'pH', 'rainfall', 'label'])
            writer.writerow([N, P, K, temp, humidity, pH, rainfall, label])
            
        return jsonify({'message': 'Row added to dataset successfully.'})
    except Exception as e:
        return jsonify({'error': f'Failed to append row: {str(e)}'}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.id == session.get('user_id'):
        return jsonify({'error': 'You cannot delete your own account.'}), 400
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': f'User "{user.username}" deleted successfully.'})

# --- Bootstrap Context ---

with app.app_context():
    db.create_all()
    
    # Seed Admin User if not exists
    admin_user = User.query.filter_by(username='admin').first()
    if not admin_user:
        admin = User(
            username='admin',
            role='admin',
            full_name='System Administrator',
            contact='1234567890',
            location='Headquarters'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("Default admin created: admin/admin123")
        
    seed_crop_database()
    check_and_train_model()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
