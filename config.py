import os
from dotenv import load_dotenv

# Load env variables from .env if it exists
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "default-fallback-key-secret-999")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///crop_recommender.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # ML settings
    MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml")
    MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
    SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
    DATASET_PATH = os.path.join(MODEL_DIR, "crop_recommendation_data.csv")
    METRICS_PATH = os.path.join(MODEL_DIR, "model_metrics.json")
