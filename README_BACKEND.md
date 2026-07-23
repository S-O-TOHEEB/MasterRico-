# EduStream Backend Development

This project contains a professional, senior-level backend implementation for the EduStream platform.

## Architecture
The backend is built using a **Modular Monolith** approach with the following technologies:
- **Node.js & TypeScript**: Core API services.
- **PostgreSQL**: Primary relational database.
- **TypeORM**: Data persistence and entity management.
- **Python (FastAPI)**: Microservice for AI/ML tasks like content tagging and summarization.

## Project Structure
- `/backend`: The main Node.js/TypeScript application.
  - `/src/entities`: Database models.
  - `/src/controllers`: Request handlers.
  - `/src/services`: Business logic.
  - `/src/routes`: API route definitions.
- `/ai_service`: Python-based AI microservice.

## Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm or npm
- PostgreSQL
- Python 3.9+

### Backend Setup
1. Navigate to the `backend` directory.
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env` and configure your database credentials.
4. Run in development mode: `pnpm dev`
5. Build for production: `pnpm build`

### AI Service Setup
1. Navigate to the `ai_service` directory.
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment.
4. Install dependencies: `pip install -r requirements.txt`
5. Run the service: `python app.py`

## API Documentation
The API follows RESTful principles. A detailed design document is available in `backend_design.md`.

## Senior-Level Features Included
- **Strong Typing**: Comprehensive TypeScript interfaces and types.
- **Entity Modeling**: Clean TypeORM entities with proper relationships and enums.
- **Security**: Helmet, CORS, and JWT-based authentication (structure ready).
- **Scalability**: Modular design that can easily be split into microservices.
- **AI Integration**: Dedicated service for compute-heavy AI tasks.
