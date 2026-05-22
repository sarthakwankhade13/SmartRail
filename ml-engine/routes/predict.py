from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from ml.model_manager import ml_manager
from database.connection import get_db
from database.models import PredictionLog
from sqlalchemy.orm import Session
from datetime import datetime

router = APIRouter()

class PredictionRequest(BaseModel):
    train_number: str
    class_type: str
    quota: str
    waitlist_position: int
    journey_date: str

class TrainingRequest(BaseModel):
    num_records: int = 50000

@router.post("/predict")
async def predict_waitlist(req: PredictionRequest, db: Session = Depends(get_db)):
    try:
        input_dict = req.model_dump()
        result = ml_manager.predict(input_dict)
        
        if "error" in result:
            raise HTTPException(status_code=503, detail=result["error"])
            
        # Log to database
        try:
            log_entry = PredictionLog(
                train_number=req.train_number,
                travel_date=req.journey_date,
                class_type=req.class_type,
                quota=req.quota,
                waitlist_position=req.waitlist_position,
                prediction_probability=result["confirmation_probability"],
                rac_probability=result["rac_probability"],
                risk_level=result["risk_level"]
            )
            db.add(log_entry)
            db.commit()
        except Exception as e:
            print(f"[Warn] Failed to log prediction: {e}")
            
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train-model")
async def train_model_endpoint(req: TrainingRequest):
    # Triggers pipeline (In production, use Celery/BackgroundTasks)
    import subprocess
    import os
    
    base_dir = os.path.join(os.path.dirname(__file__), '..')
    
    try:
        # 1. Generate Data
        subprocess.run(['python', 'preprocessing/data_generator.py'], cwd=base_dir, check=True)
        # 2. Train Model
        subprocess.run(['python', 'training/train_xgboost.py'], cwd=base_dir, check=True)
        
        ml_manager.load_models()
        return {"status": "success", "message": "Models trained and loaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prediction-history")
async def get_prediction_history(train_number: str, db: Session = Depends(get_db)):
    logs = db.query(PredictionLog).filter(PredictionLog.train_number == train_number).order_by(PredictionLog.created_at.desc()).limit(10).all()
    return [{"date": log.created_at, "prob": log.prediction_probability, "wl": log.waitlist_position} for log in logs]

@router.get("/health")
async def health_check():
    return {
        "status": "ok", 
        "model_loaded": ml_manager.model_conf is not None,
        "service": "Enterprise Waitlist Engine"
    }
