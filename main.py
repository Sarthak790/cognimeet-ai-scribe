from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import bcrypt
import jwt
import sqlite3
import boto3
import os
import datetime
from dotenv import load_dotenv
from bot import join_meeting

load_dotenv()

app = FastAPI()

# --- CORS SETUP ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🛡️ SECURITY & DATABASE SETUP
# ==========================================
SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-hackathon-key-2026")
ALGORITHM = "HS256"

security = HTTPBearer()

# Connect to SQLite (Creates 'users.db' automatically if it doesn't exist)
conn = sqlite3.connect("users.db", check_same_thread=False)
cursor = conn.cursor()

# Create the users table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL
    )
""")
conn.commit()

# --- NATIVE BCRYPT SECURITY UTILITIES ---
def get_password_hash(password: str) -> str:
    # bcrypt requires bytes, so we encode the string
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8') # Store in DB as a standard string

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')
    hashed_password_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password=password_bytes, hashed_password=hashed_password_bytes)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=24) # Token lives for 24 hours
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Dependency to check for a valid JWT token on protected routes
def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ==========================================
# 👤 AUTHENTICATION ENDPOINTS
# ==========================================
class AuthRequest(BaseModel):
    email: str
    password: str

@app.post("/signup")
def signup(user: AuthRequest):
    try:
        hashed_pw = get_password_hash(user.password)
        cursor.execute("INSERT INTO users (email, hashed_password) VALUES (?, ?)", (user.email, hashed_pw))
        conn.commit()
        
        # Automatically log them in after signup
        token = create_access_token({"sub": user.email})
        return {"message": "User created successfully", "token": token}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already registered")

@app.post("/login")
def login(user: AuthRequest):
    cursor.execute("SELECT hashed_password FROM users WHERE email = ?", (user.email,))
    result = cursor.fetchone()
    
    if not result or not verify_password(user.password, result[0]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    token = create_access_token({"sub": user.email})
    return {"message": "Login successful", "token": token}


# ==========================================
# 🤖 BOT & DATA ENDPOINTS (PROTECTED)
# ==========================================
class MeetRequest(BaseModel):
    url: str

@app.post("/deploy-bot")
def deploy_bot(request: MeetRequest, background_tasks: BackgroundTasks, current_user: str = Depends(verify_token)):
    print(f"--- 🚀 DEPLOY COMMAND RECEIVED FROM: {current_user} ---")
    background_tasks.add_task(join_meeting, request.url)
    return {
        "status": "success", 
        "message": "Bot deployed! It is joining the meeting now in the background.", 
    }

@app.get("/summaries")
def get_summaries(current_user: str = Depends(verify_token)):
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            region_name=os.environ.get("AWS_REGION")
        )
        bucket = os.environ.get("AWS_BUCKET_NAME")
        
        response = s3_client.list_objects_v2(Bucket=bucket)
        
        summaries = []
        if 'Contents' in response:
            sorted_files = sorted(response['Contents'], key=lambda obj: obj['LastModified'], reverse=True)[:5]
            for obj in sorted_files:
                file_obj = s3_client.get_object(Bucket=bucket, Key=obj['Key'])
                text = file_obj['Body'].read().decode('utf-8')
                summaries.append({"id": obj['Key'], "content": text})
                
        return {"summaries": summaries}
    except Exception as e:
        print(f"S3 Read Error: {e}")
        return {"error": str(e)}

@app.get("/")
def read_root():
    return {"status": "AI Meeting Scribe API is live!"}