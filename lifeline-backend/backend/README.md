# Lifeline Backend

Backend API for **Lifeline**, an AI-assisted medical record management and emergency-response application.

The backend provides authentication, medical report processing, OCR, AI-powered medical information extraction, structured medical record storage, patient timelines, doctor-ready summaries, and the **Vitalis AI medical assistant**.

---

# Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Complete System Flow](#complete-system-flow)
- [Project Structure](#project-structure)
- [Authentication](#authentication)
- [Medical Report Upload](#medical-report-upload)
- [OCR System](#ocr-system)
- [AI Medical Extraction](#ai-medical-extraction)
- [Medical Records](#medical-records)
- [Medical Timeline](#medical-timeline)
- [Doctor Summary](#doctor-summary)
- [Vitalis AI Assistant](#vitalis-ai-assistant)
- [Logging](#logging)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Local Setup](#local-setup)
- [Running the Backend](#running-the-backend)
- [Swagger Documentation](#swagger-documentation)
- [Testing](#testing)
- [Security and Data Isolation](#security-and-data-isolation)
- [Current Limitations](#current-limitations)
- [Integration Freeze](#integration-freeze)
- [Future Improvements](#future-improvements)

---

# Overview

Lifeline's backend acts as the processing and API layer between the frontend, database, OCR engine, and AI services.

The backend is responsible for:

- User registration
- User authentication
- JWT-based authorization
- Medical report uploads
- OCR text extraction
- AI-powered medical information extraction
- Structured medical record storage
- Patient-specific medical timelines
- Doctor-ready medical summaries
- Vitalis AI medical assistance
- Application logging
- User-specific data isolation

Medical information is associated with the authenticated user.

Protected endpoints obtain the user identity from the authenticated JWT rather than accepting an arbitrary user ID from the frontend.

---

# Current Status

## Core Backend Integration Freeze: COMPLETE

The core backend MVP has been implemented and tested.

### Completed Components

- [x] FastAPI application
- [x] Uvicorn development server
- [x] Supabase database integration
- [x] User registration
- [x] Password hashing
- [x] User login
- [x] JWT access tokens
- [x] JWT verification
- [x] Protected API routes
- [x] Authenticated user retrieval
- [x] Medical report upload
- [x] Image/PDF report processing
- [x] Tesseract OCR
- [x] OCR confidence handling
- [x] Groq AI integration
- [x] Structured AI medical extraction
- [x] AI JSON parsing
- [x] Medical record storage
- [x] User-specific medical record retrieval
- [x] Medical timeline
- [x] Doctor summary generation
- [x] Vitalis AI assistant
- [x] User-specific Vitalis context
- [x] Structured application logging
- [x] End-to-end backend testing

The backend is currently **ready for frontend integration**.

---

# Tech Stack

## Backend

- Python
- FastAPI
- Uvicorn

## Database

- Supabase
- PostgreSQL

## Authentication

- JWT
- Password hashing
- FastAPI dependency-based authentication

## OCR

- Tesseract OCR
- pytesseract
- Pillow

## AI

- Groq API
- Llama model

## Logging

- Loguru

## Configuration

- Pydantic Settings
- `.env` environment configuration

## Deployment

- Railway

---

# Architecture

The backend follows a modular service-oriented architecture.

```text
                         FRONTEND
                            |
                            | HTTP / REST
                            v
                     +-------------+
                     |   FastAPI   |
                     +-------------+
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
        Authentication   Upload API     AI Services
             |              |              |
             v              v              v
            JWT           OCR          Groq / Llama
             |              |              |
             |              v              |
             |        Extracted Text       |
             |              |              |
             |              v              |
             |        Structured Data      |
             |              |              |
             +--------------+--------------+
                            |
                            v
                       Supabase
                            |
                 +----------+----------+
                 |                     |
                 v                     v
             Medical Records       User Data
                 |
        +--------+--------+
        |        |        |
        v        v        v
     Timeline Summary  Vitalis
Complete System Flow
1. Authentication Flow
User
 |
 | Register
 v
POST /auth/register
 |
 v
Password Hashing
 |
 v
Supabase Users Table

Login:

User
 |
 | Email + Password
 v
POST /auth/login
 |
 v
Verify Password
 |
 v
Create JWT
 |
 v
Return Access Token

Protected request:

Frontend
 |
 | Authorization: Bearer <JWT>
 v
FastAPI Route
 |
 v
get_current_user()
 |
 v
Verify JWT
 |
 v
Extract user_id
 |
 v
Protected Service
2. Medical Report Processing Flow
Medical Report
      |
      v
   Upload API
      |
      v
     OCR
      |
      v
 Extracted Text
      |
      v
    Groq AI
      |
      v
Structured JSON
      |
      v
  JSON Parser
      |
      v
Medical Record
      |
      v
   Supabase

The backend therefore converts an uploaded medical document into structured medical information that can be reused by the rest of the application.

Project Structure

The current backend follows this general structure:

backend/
│
├── app/
│   │
│   ├── ai/
│   │   ├── parser.py
│   │   ├── prompts.py
│   │   ├── ocr_manager.py
│   │   ├── tesseract_engine.py
│   │   ├── vision_engine.py
│   │   └── providers/
│   │       └── groq_provider.py
│   │
│   ├── api/
│   │   └── upload.py
│   │
│   ├── auth/
│   │   ├── routes.py
│   │   ├── schemas.py
│   │   └── security.py
│   │
│   ├── config/
│   │   └── settings.py
│   │
│   ├── database/
│   │   └── supabase.py
│   │
│   ├── services/
│   │   └── medical_record_service.py
│   │
│   ├── summary/
│   │   ├── routes.py
│   │   └── service.py
│   │
│   ├── timeline/
│   │   ├── routes.py
│   │   └── service.py
│   │
│   ├── vitalis/
│   │   ├── routes.py
│   │   ├── schemas.py
│   │   └── service.py
│   │
│   ├── utils/
│   │   └── logger.py
│   │
│   └── main.py
│
├── logs/
│   └── app.log
│
├── uploads/
│
├── .env
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md

The .env file and other secret files must never be committed to Git.

Authentication

Lifeline uses JWT-based authentication.

Registration

Endpoint:

POST /auth/register

The registration process:

Receives user information.
Checks whether the email already exists.
Hashes the user's password.
Stores the user in Supabase.
Returns a successful registration response.

Passwords are not stored in plaintext.

Login

Endpoint:

POST /auth/login

The login process:

Finds the user by email.
Verifies the supplied password against the stored password hash.
Creates a JWT access token.
Returns the token to the frontend.

The JWT contains the authenticated user's identity, including the user ID.

Current User

Protected endpoints use the authentication dependency:

get_current_user()

This dependency:

Reads the Bearer token.
Verifies the JWT.
Rejects invalid or expired tokens.
Returns the authenticated user's payload.

This allows protected services to identify the user without trusting a user ID supplied directly by the client.

Medical Report Upload

Endpoint:

POST /upload

The upload endpoint accepts a medical report and processes it through the AI pipeline.

Supported report inputs include image/PDF-based medical documents according to the configured upload handling.

The processing pipeline is:

Upload
  |
  v
Save File
  |
  v
OCR
  |
  v
Extract Text
  |
  v
Groq AI
  |
  v
Parse JSON
  |
  v
Store Medical Record
OCR System

The current OCR provider is:

Tesseract OCR

The OCR system is separated into two layers.

OCR Manager

The OCR manager is responsible for:

Starting the OCR request
Calling the configured OCR engine
Measuring execution time
Recording confidence
Logging OCR results
Handling low-confidence output
Tesseract Engine

Tesseract performs the actual image-to-text conversion.

The engine returns:

(text, confidence)

The current confidence threshold is:

0.70

If confidence is at least 0.70, the extracted text is accepted normally.

If confidence is below 0.70, the system logs a warning and currently continues using the Tesseract output.

This is important for handwritten or low-quality reports because OCR quality can significantly affect the downstream AI extraction.

Google Vision

Google Cloud Vision was investigated as a possible fallback OCR provider.

However, it is not currently part of the active Lifeline OCR pipeline because enabling the required Google Cloud configuration involved billing requirements.

Therefore:

Current OCR:
Tesseract

The architecture keeps OCR provider separation so another provider can be introduced later without redesigning the upload pipeline.

AI Medical Extraction

After OCR, the extracted text is sent to the Groq AI provider.

The AI is instructed to return structured JSON containing:

{
  "diagnosis": [],
  "medicines": [],
  "allergies": [],
  "doctor": null,
  "hospital": null,
  "dates": [],
  "lab_values": {},
  "raw_text": ""
}
Extraction Rules

The AI is instructed to:

Return only JSON
Avoid explanations
Avoid inventing medical information
Preserve the OCR text
Use empty lists for unavailable list fields
Use {} for unavailable lab values
Use null for unavailable doctor/hospital information
AI JSON Parsing

AI responses are passed through the backend parser before being stored.

The parser:

Cleans markdown code fences if present.
Attempts JSON parsing.
Detects malformed JSON.
Raises an AIResponseError if the response cannot be parsed.

This prevents invalid AI output from silently entering the medical-record database.

Groq Provider

The Groq provider is responsible for communication with the Groq API.

The provider:

Uses the configured Groq API key.
Uses the configured model.
Sends prompts to the AI model.
Returns the generated response.
Logs request attempts and execution time.

The model is configured through environment variables rather than being hardcoded into application logic.

Medical Records

Medical information extracted from uploaded reports is stored in Supabase.

Medical records are associated with:

user_id

This allows the backend to retrieve only records belonging to the authenticated user.

The medical record data can contain:

Diagnosis
Medicines
Allergies
Doctor
Hospital
Dates
Laboratory values
Raw OCR text
Record metadata
Creation timestamp
Medical Timeline

Endpoint:

GET /timeline/

The timeline retrieves the authenticated user's medical records.

Records are retrieved using the authenticated user's ID and ordered by creation date.

Conceptually:

Authenticated User
        |
        v
   get_current_user()
        |
        v
      user_id
        |
        v
Medical Records Query
        |
        v
   Ordered Records
        |
        v
     Timeline

The timeline therefore represents the user's medical history using the records already stored in the system.

Doctor Summary

Endpoint:

GET /summary/

The summary service retrieves the authenticated user's medical records and aggregates verified information.

The service combines information such as:

Diagnoses
Medications
Allergies
Doctors
Hospitals

The structured information is then supplied to the Groq model with strict instructions that the model must not invent medical facts.

The intended output is a concise doctor-ready summary.

The summary system therefore follows:

Medical Records
      |
      v
Verified Information
      |
      v
Aggregation
      |
      v
Doctor Summary Prompt
      |
      v
Groq
      |
      v
Doctor-Ready Summary
Vitalis AI Assistant

Vitalis is Lifeline's medical-record-based AI assistant.

Endpoint:

POST /vitalis/chat

Vitalis is protected by JWT authentication.

The assistant receives:

User Question

and combines it with:

Patient Medical Summary
+
Patient Medical Records

The resulting context is sent to the Groq model.

Vitalis Safety Rules

Vitalis is instructed to:

Use only the provided patient information.
Not invent patient history.
Not create diagnoses that are absent from the records.
Not invent medications.
Not assume medical history.
Clearly state when the available records do not contain enough information.

If the answer cannot be found in the available records, Vitalis responds:

I don't have enough information in your medical records.

Vitalis therefore acts as a medical-record assistant rather than an unrestricted medical knowledge system.

Logging

The backend uses Loguru for structured application logging.

Logs are written to:

stdout

and:

logs/app.log

The log file is configured with:

Rotation: 10 MB
Retention: 7 days
Logged Operations

Important operations include:

OCR requests
OCR confidence
OCR execution time
OCR failures
AI request attempts
AI execution time
API request status through Uvicorn/FastAPI logs

Example:

OCR request started
OCR completed
OCR confidence below threshold
AI request started
AI request completed

Logs are intended for debugging and operational monitoring.

API Endpoints
General
GET /
GET /health
Authentication
POST /auth/register
POST /auth/login
GET  /auth/me
Medical Reports
POST /upload
Timeline
GET /timeline/
Doctor Summary
GET /summary/
Vitalis
POST /vitalis/chat
Environment Variables

Secrets and configuration values are stored in .env.

Typical configuration includes:

SUPABASE_URL=
SUPABASE_KEY=

JWT_SECRET_KEY=
JWT_ALGORITHM=

GROQ_API_KEY=
GROQ_MODEL=

LOG_LEVEL=

Actual secret values must never be committed to Git.

The repository should contain an .env.example file containing variable names without real credentials.

Local Setup

Clone the repository:

git clone <repository-url>

Enter the backend directory:

cd backend

Create a virtual environment:

python -m venv venv

Activate it on Windows:

venv\Scripts\activate

Activate it on macOS/Linux:

source venv/bin/activate

Install dependencies:

pip install -r requirements.txt

Create the environment file:

.env

Add the required credentials.

Running the Backend

Start the development server:

uvicorn app.main:app --reload

The backend will normally be available at:

http://127.0.0.1:8000
Swagger Documentation

FastAPI automatically provides interactive API documentation.

Swagger UI:

http://127.0.0.1:8000/docs

OpenAPI schema:

http://127.0.0.1:8000/openapi.json

Swagger can be used to test:

Authentication
Protected routes
Report upload
Timeline
Summary
Vitalis
Testing

The backend has been tested through the FastAPI/Swagger interface and local development server.

Verified Authentication
User registration
User login
JWT generation
Authenticated /auth/me
Protected route authentication
Verified Upload Pipeline

The end-to-end upload flow has been tested:

Report
  |
  v
Upload
  |
  v
Tesseract OCR
  |
  v
Groq AI
  |
  v
JSON Parsing
  |
  v
Medical Record
  |
  v
Supabase

Successful requests return:

200 OK
Verified Timeline

The authenticated timeline endpoint has been tested successfully.

Verified Summary

The doctor summary generation has been tested successfully.

Verified Vitalis

The authenticated Vitalis chat endpoint has been tested successfully.

Security and Data Isolation

Lifeline uses authenticated user context to isolate medical records.

Protected routes use:

get_current_user()

rather than trusting arbitrary user IDs sent by the frontend.

The authenticated JWT provides the user identity.

Medical record queries use that authenticated identity when retrieving records.

Conceptually:

JWT
 |
 v
Authenticated User
 |
 v
user_id
 |
 v
Supabase Query
 |
 v
Only that user's records

This prevents a frontend request from simply supplying another user's ID to retrieve their medical records.

Error Handling

The backend handles several classes of errors including:

Invalid authentication tokens
Expired JWTs
Invalid login credentials
Missing files
OCR failures
Low OCR confidence
Invalid AI responses
Invalid JSON returned by the AI provider
Database/service errors

AI parsing failures are surfaced through:

AIResponseError

rather than silently storing malformed AI output.

Current Limitations

The current backend is an MVP and has several known limitations.

OCR Accuracy

Tesseract OCR can produce inaccurate results for:

Handwritten medical reports
Poor-quality scans
Blurry images
Unusual handwriting
Low-resolution documents

The downstream AI extraction quality depends heavily on OCR quality.

OCR Fallback

The architecture allows additional OCR providers to be introduced.

Google Vision was evaluated but is not currently enabled because the required Google Cloud configuration involves billing.

The active OCR provider is currently:

Tesseract
AI Dependency

Medical extraction, summaries, and Vitalis responses depend on the configured Groq model and API availability.

MVP Scope

The backend is designed for the Lifeline hackathon MVP.

It should not be treated as a standalone clinical decision-making or diagnostic system.

AI-generated information must be treated as an assistive layer over the stored medical records.

Integration Freeze

The current backend represents the core integration-freeze version.

The primary backend components are now connected:

Authentication
      |
      v
Report Upload
      |
      v
OCR
      |
      v
AI Extraction
      |
      v
Medical Records
      |
      +------------------+
      |                  |
      v                  v
   Timeline           Summary
                         |
                         v
                      Vitalis

The backend is therefore ready to be consumed by the Lifeline frontend.

Future backend changes should avoid unnecessary architectural changes unless they are required for:

Frontend integration
Security
Stability
Critical bug fixes
Hackathon requirements
Future Improvements

Potential future improvements include:

More robust OCR fallback providers
Better handwritten document processing
Improved document preprocessing
Structured medical record validation
More detailed laboratory-value handling
Medical record search
Report categorization
Emergency medical profile generation
Improved AI response validation
Rate limiting
Production-grade monitoring
Automated backend tests
Production deployment hardening

These are future improvements and are not considered part of the current integration-freeze implementation.

Development Principles

The Lifeline backend follows these principles:

1. Authentication First

Protected medical data must always be accessed in the context of the authenticated user.

2. Structured Medical Data

Medical reports should be converted into structured information instead of relying exclusively on raw OCR text.

3. AI as an Assistive Layer

AI should operate on verified medical information and must not be treated as an unrestricted source of patient history.

4. Modular Services

OCR, AI providers, authentication, summaries, timelines, and Vitalis are separated into dedicated modules.

5. Environment-Based Secrets

API keys, database credentials, and JWT secrets must remain outside source control.

6. Logging

Important backend operations should be observable through structured logs.

Backend Status
┌──────────────────────────────────────────┐
│        LIFELINE BACKEND STATUS           │
├──────────────────────────────────────────┤
│ FastAPI                    COMPLETE       │
│ Supabase                   COMPLETE       │
│ Authentication             COMPLETE       │
│ JWT Authorization          COMPLETE       │
│ Report Upload              COMPLETE       │
│ Tesseract OCR              COMPLETE       │
│ Groq AI                    COMPLETE       │
│ Medical Extraction         COMPLETE       │
│ Medical Records            COMPLETE       │
│ Timeline                   COMPLETE       │
│ Doctor Summary             COMPLETE       │
│ Vitalis AI                 COMPLETE       │
│ Logging                    COMPLETE       │
│ End-to-End Testing         COMPLETE       │
│ Frontend Integration       READY          │
└──────────────────────────────────────────┘
Lifeline

