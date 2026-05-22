from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import engine, Base
from routes.predict import router as predict_router

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Train Waitlist Confirmation Prediction System",
    description="Enterprise-grade AI/ML engine for Indian Railways",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api/ml", tags=["predictions"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
