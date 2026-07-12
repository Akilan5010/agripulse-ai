import sys
import os

def test_imports():
    print("Testing libraries imports...")
    try:
        import flask
        import flask_sqlalchemy
        import sklearn
        import pandas
        import numpy
        import dotenv
        import cryptography
        print("  [PASS] All libraries imported successfully.")
        return True
    except ImportError as e:
        print(f"  [FAIL] Missing library: {str(e)}")
        print("  Please install dependencies: pip install -r requirements.txt")
        return False

def test_ml_pipeline():
    print("Testing Machine Learning training pipeline...")
    try:
        from ml.trainer import train_model
        
        csv_p = "ml/crop_recommendation_data_test.csv"
        model_p = "ml/model_test.pkl"
        scaler_p = "ml/scaler_test.pkl"
        metrics_p = "ml/model_metrics_test.json"
        
        # Train
        train_model(csv_p, model_p, scaler_p, metrics_p)
        print("  [PASS] ML dataset generation & model training completed successfully.")
        
        # Test loading and predicting
        from ml.trainer import predict_crop
        crop, conf = predict_crop(80, 50, 40, 27.5, 75, 6.5, 150, model_p, scaler_p)
        print(f"  [PASS] ML prediction completed successfully. Result: {crop} with {conf*100:.1f}% confidence.")
        
        # Cleanup test files
        for f in [csv_p, model_p, scaler_p, metrics_p]:
            if os.path.exists(f):
                os.remove(f)
                
        return True
    except Exception as e:
        print(f"  [FAIL] ML pipeline error: {str(e)}")
        return False

def test_database_models():
    print("Testing Flask app initialization and database schema creation...")
    try:
        from app import app, db, User, CropInfo
        
        # Configure app to use a separate test SQLite DB in memory or temp file
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        app.config['TESTING'] = True
        
        with app.app_context():
            db.create_all()
            
            # Verify tables exist and default admin was seeded
            admin = User.query.filter_by(username='admin').first()
            if admin and admin.role == 'admin':
                print("  [PASS] Default administrator account successfully seeded.")
            else:
                print("  [FAIL] Default administrator account was NOT seeded.")
                return False
                
            # Verify crop catalog is seeded
            crops = CropInfo.query.all()
            if len(crops) > 0:
                print(f"  [PASS] Crop encyclopedia database successfully seeded with {len(crops)} crops.")
            else:
                print("  [FAIL] Crop encyclopedia database was NOT seeded.")
                return False
                
        print("  [PASS] Database creation and seeding completed successfully.")
        return True
    except Exception as e:
        print(f"  [FAIL] Database initialization failed: {str(e)}")
        return False

if __name__ == '__main__':
    print("==================================================")
    print("Starting AgriPulse AI System Verification Tests...")
    print("==================================================")
    
    imports_ok = test_imports()
    if not imports_ok:
        print("\nVerification terminated due to missing libraries. Please install dependencies.")
        sys.exit(1)
        
    db_ok = test_database_models()
    ml_ok = test_ml_pipeline()
    
    print("==================================================")
    if db_ok and ml_ok:
        print("Verification SUCCESSFUL! The application is ready to run.")
        print("Run 'python app.py' to launch the server.")
        print("==================================================")
        sys.exit(0)
    else:
        print("Verification FAILED. Please review the errors logged above.")
        print("==================================================")
        sys.exit(1)
