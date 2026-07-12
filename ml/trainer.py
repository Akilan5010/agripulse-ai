import os
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# Ensure directories exist
os.makedirs(os.path.dirname(os.path.abspath(__file__)), exist_ok=True)

# Define crop baseline conditions for synthetic dataset generation
# format: (N, P, K, temp, humidity, pH, rainfall)
CROP_BASELINES = {
    'Rice': {'N': (80, 120), 'P': (35, 60), 'K': (35, 45), 'temp': (20, 30), 'humidity': (80, 90), 'pH': (5.0, 6.5), 'rainfall': (150, 300)},
    'Maize': {'N': (60, 100), 'P': (35, 60), 'K': (30, 50), 'temp': (18, 27), 'humidity': (55, 70), 'pH': (5.5, 7.0), 'rainfall': (60, 110)},
    'Cotton': {'N': (100, 140), 'P': (30, 50), 'K': (30, 50), 'temp': (25, 35), 'humidity': (35, 60), 'pH': (5.8, 8.0), 'rainfall': (50, 100)},
    'Wheat': {'N': (70, 110), 'P': (40, 60), 'K': (30, 50), 'temp': (12, 22), 'humidity': (40, 60), 'pH': (6.0, 7.5), 'rainfall': (40, 80)},
    'Chickpea': {'N': (20, 40), 'P': (55, 80), 'K': (75, 90), 'temp': (15, 25), 'humidity': (15, 30), 'pH': (6.0, 9.0), 'rainfall': (30, 60)},
    'Kidneybeans': {'N': (10, 35), 'P': (45, 70), 'K': (15, 30), 'temp': (15, 25), 'humidity': (18, 35), 'pH': (5.5, 6.0), 'rainfall': (60, 100)},
    'Mango': {'N': (15, 40), 'P': (15, 30), 'K': (30, 50), 'temp': (27, 35), 'humidity': (45, 60), 'pH': (5.5, 7.0), 'rainfall': (80, 150)},
    'Banana': {'N': (80, 120), 'P': (70, 90), 'K': (120, 150), 'temp': (25, 33), 'humidity': (75, 90), 'pH': (5.5, 6.5), 'rainfall': (150, 250)},
    'Orange': {'N': (20, 50), 'P': (10, 30), 'K': (10, 30), 'temp': (10, 30), 'humidity': (80, 95), 'pH': (5.5, 7.5), 'rainfall': (100, 180)},
    'Coconut': {'N': (60, 90), 'P': (50, 70), 'K': (100, 140), 'temp': (25, 30), 'humidity': (75, 90), 'pH': (5.0, 8.0), 'rainfall': (120, 220)},
    'Coffee': {'N': (80, 110), 'P': (15, 30), 'K': (25, 45), 'temp': (20, 26), 'humidity': (50, 70), 'pH': (5.5, 6.5), 'rainfall': (100, 200)}
}

def generate_dataset(file_path, num_samples_per_crop=150):
    """Generates a realistic agriculture dataset for crop prediction."""
    np.random.seed(42)
    rows = []
    
    for crop, conditions in CROP_BASELINES.items():
        for _ in range(num_samples_per_crop):
            row = {}
            for feature, (low, high) in conditions.items():
                # Generate values with mean at center of the range, and a small standard deviation
                mean = (low + high) / 2.0
                std = (high - low) / 6.0 # 99% values fall in range
                val = np.random.normal(mean, std)
                # Keep values within realistic bounds
                val = max(0.0, val)
                if feature == 'humidity':
                    val = min(100.0, val)
                row[feature] = round(val, 2)
            row['label'] = crop
            rows.append(row)
            
    df = pd.DataFrame(rows)
    df.to_csv(file_path, index=False)
    print(f"Generated synthetic agricultural dataset with {len(df)} samples at {file_path}")
    return df

def train_model(csv_path, model_path, scaler_path, metrics_path):
    """Trains the Random Forest model and saves model, scaler and metrics."""
    if not os.path.exists(csv_path):
        df = generate_dataset(csv_path)
    else:
        df = pd.read_csv(csv_path)
        
    X = df[['N', 'P', 'K', 'temp', 'humidity', 'pH', 'rainfall']]
    y = df['label']
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Fit scaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Fit classifier
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)
    
    # Feature importances
    feature_importances = dict(zip(X.columns, model.feature_importances_.tolist()))
    
    # Save model and scaler
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
        
    # Save metrics JSON
    metrics = {
        'accuracy': float(accuracy),
        'sample_count': int(len(df)),
        'feature_importances': feature_importances,
        'classification_report': classification_report(y_test, y_pred, output_dict=True)
    }
    
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=4)
        
    print(f"Model successfully trained with accuracy: {accuracy * 100:.2f}%")
    return model, scaler, metrics

def predict_crop(n, p, k, temp, hum, ph, rain, model_path, scaler_path):
    """Predicts crop based on given parameters."""
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    with open(scaler_path, 'rb') as f:
        scaler = pickle.load(f)
        
    features = np.array([[n, p, k, temp, hum, ph, rain]])
    scaled_features = scaler.transform(features)
    
    crop = model.predict(scaled_features)[0]
    probabilities = model.predict_proba(scaled_features)[0]
    class_idx = np.where(model.classes_ == crop)[0][0]
    confidence = float(probabilities[class_idx])
    
    return crop, confidence

if __name__ == '__main__':
    # When run directly, train the model
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_p = os.path.join(base_dir, "crop_recommendation_data.csv")
    model_p = os.path.join(base_dir, "model.pkl")
    scaler_p = os.path.join(base_dir, "scaler.pkl")
    metrics_p = os.path.join(base_dir, "model_metrics.json")
    
    train_model(csv_p, model_p, scaler_p, metrics_p)
