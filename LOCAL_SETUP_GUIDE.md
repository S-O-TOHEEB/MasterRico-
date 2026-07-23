# EduStream Local Setup Guide

Follow these steps to set up and run the EduStream backend and AI services on your local development environment.

## 1. Prerequisites

Ensure you have the following installed on your machine:

*   **Node.js**: Version 18 or higher. [Download here](https://nodejs.org/).
*   **Package Manager**: `pnpm` is recommended, but `npm` or `yarn` will also work.
*   **PostgreSQL**: A running instance of PostgreSQL. [Download here](https://www.postgresql.org/download/).
*   **Python**: Version 3.9 or higher. [Download here](https://www.python.org/downloads/).

## 2. Database Setup

1.  Open your PostgreSQL client (like pgAdmin or psql).
2.  Create a new database named `edustream`:
    ```sql
    CREATE DATABASE edustream;
    ```
3.  Ensure you have a user with permissions to create tables in this database.

## 3. Core Backend Setup (Node.js & TypeScript)

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```
2.  **Install dependencies**:
    ```bash
    pnpm install
    # OR if using npm:
    npm install
    ```
3.  **Configure environment variables**:
    *   Copy the `.env.example` file to a new file named `.env`:
        ```bash
        cp .env.example .env
        ```
    *   Open `.env` and update the database credentials to match your local PostgreSQL setup:
        ```env
        DB_HOST=localhost
        DB_PORT=5432
        DB_USERNAME=your_username
        DB_PASSWORD=your_password
        DB_NAME=edustream
        JWT_SECRET=choose_a_secure_random_string
        ```
4.  **Run the application in development mode**:
    ```bash
    pnpm dev
    # OR if using npm:
    npm run dev
    ```
    The server should now be running at `http://localhost:3000`. You can check the health by visiting `http://localhost:3000/health`.

## 4. AI Service Setup (Python & FastAPI)

1.  **Navigate to the AI service directory**:
    ```bash
    cd ../ai_service
    ```
2.  **Create a virtual environment**:
    ```bash
    python -m venv venv
    ```
3.  **Activate the virtual environment**:
    *   **Windows**: `venv\Scripts\activate`
    *   **macOS/Linux**: `source venv/bin/activate`
4.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
5.  **Run the service**:
    ```bash
    python app.py
    ```
    The AI service will be running at `http://localhost:8000`. You can check its health at `http://localhost:8000/health`.

## 5. Testing the Setup

You can use tools like **Postman** or **Insomnia** to test the API endpoints.

*   **Health Check**: `GET http://localhost:3000/health`
*   **Register User**: `POST http://localhost:3000/api/v1/auth/register`
    *   Body (JSON):
        ```json
        {
          "email": "test@example.com",
          "password": "securepassword123",
          "firstName": "John",
          "lastName": "Doe",
          "role": "learner"
        }
        ```
*   **Login**: `POST http://localhost:3000/api/v1/auth/login`
    *   Body (JSON):
        ```json
        {
          "email": "test@example.com",
          "password": "securepassword123"
        }
        ```

## Troubleshooting

*   **Database Connection Issues**: Double-check your `.env` file credentials and ensure PostgreSQL is running and accessible on the specified port.
*   **Port Conflicts**: If port 3000 or 8000 is already in use, you can change the `PORT` in the `.env` file or in `ai_service/app.py`.
*   **TypeScript Errors**: Ensure you have run `pnpm install` correctly to fetch all `@types` definitions.
