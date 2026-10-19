import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal 
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
model = joblib.load('mental_health_model.pkl')
top_cuntories = ['Other', 'India', 'USA', 'Canada', 'Australia', 'UK', 'Germany','Mexico', 'Turkey', 'France']
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define a Pydantic model for input validation
class Student_Data(BaseModel):
    Age: int = Field(..., ge=0, le=100, description="Age of the student")
    Gender: str = Literal['Male', 'Female', 'Other'] 
    Country: str
    Academic_Level: str = Literal['High School', 'Undergraduate', 'Graduate']
    Most_Used_Platform: str = Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter',
                                    'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp',
                                    'WeChat']
    Purpose_Of_Use: str = Literal['Networking', 'Education', 'Entertainment', 'News']
    Avg_Daily_Usage_Hours: float = Field(..., ge=0, le=24, description="Average daily usage hours of social media")
    Daily_Unlocks: int = Field(..., ge=0, description="Number of times the phone is unlocked daily")
    Study_Hours: float = Field(..., ge=0, le=24, description="Average study hours per day")
    Physical_Activity_Hours: float = Field(..., ge=0, le=24, description="Average physical activity hours per day")
    Sleep_Hours_Per_Night: float = Field(..., ge=0, le=24, description="Average sleep hours per night")
    Stress_Level: str = Literal['Medium', 'Low', 'Very High', 'High']

# describe what we send back
class Prediction_Response(BaseModel):
    Mental_Health_Score: float


@app.get("/")
def greet():
    return {"message": "Welcome to the Mental Health Prediction API!"}



@app.post("/predict", response_model=Prediction_Response)
def predict(data: Student_Data):
    cuntory_groud = data.Country if data.Country in top_cuntories else 'Other'

    input_raw = pd.DataFrame([{
        'Age': data.Age,
        'Gender': data.Gender,
        'Country': data.Country,
        'Academic_Level': data.Academic_Level,
        'Most_Used_Platform': data.Most_Used_Platform,
        'Purpose_Of_Use': data.Purpose_Of_Use,
        'Avg_Daily_Usage_Hours': data.Avg_Daily_Usage_Hours,
        'Daily_Unlocks': data.Daily_Unlocks,
        'Study_Hours': data.Study_Hours,
        'Physical_Activity_Hours': data.Physical_Activity_Hours,
        'Sleep_Hours_Per_Night': data.Sleep_Hours_Per_Night,
        'Stress_Level': data.Stress_Level,
        'Grouped_Country': cuntory_groud 
        }])
    prediction = model.predict(input_raw)[0]
    return Prediction_Response(Mental_Health_Score=float(prediction))
