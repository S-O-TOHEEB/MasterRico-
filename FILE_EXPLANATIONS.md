# EduStream Project: File Structure & Logic Explanation

This document provides a senior-level explanation of the purpose and functionality of each key file in the EduStream backend architecture.

---

## 1. Core Backend (`/backend`)

The backend is built with **Node.js** and **TypeScript**, following a clean, modular architecture.

### Configuration & Entry
*   **`src/index.ts`**: The "Heart" of the application. It initializes the Express server, connects middlewares (Security, CORS, Logging), registers API routes, and starts the listener.
*   **`src/config/database.ts`**: The "Bridge" to your data. It configures **TypeORM** to connect to PostgreSQL, managing how entities are mapped to database tables.
*   **`.env.example`**: The "Blueprint" for secrets. It lists all required environment variables (DB credentials, JWT keys) without exposing real values.
*   **`tsconfig.json`**: The "Rulebook" for TypeScript. It defines how the code is compiled, ensuring strict type safety and enabling modern features like decorators.
*   **`Dockerfile` & `docker-compose.yml`**: The "Shipping Containers." They package the entire environment so it runs identically on any machine.

### Data Layer (Entities)
*   **`src/entities/User.ts`**: Defines the user structure, roles (Learner/Creator), and secure password storage.
*   **`src/entities/Course.ts`**: Manages course metadata, pricing, and status (Draft/Published).
*   **`src/entities/Media.ts`**: The "Traffic Controller" for files. It stores URLs and metadata for videos and documents, keeping the database light.

### Business Logic (Services & Controllers)
*   **`src/services/AuthService.ts`**: Contains the complex logic for registration, password hashing, and JWT generation.
*   **`src/services/StorageService.ts`**: Manages the logic for file uploads and video streaming references.
*   **`src/controllers/AuthController.ts`**: The "Receptionist." It receives HTTP requests, calls the right Service, and sends back the formatted JSON response.

### Infrastructure (Middlewares & Utils)
*   **`src/middlewares/auth.ts`**: The "Security Guard." It checks JWT tokens and verifies if a user has the right permissions (e.g., only Creators can upload courses).
*   **`src/middlewares/errorHandler.ts`**: The "Safety Net." It catches any code crashes and logs them gracefully instead of letting the server die.
*   **`src/middlewares/validate.ts`**: The "Inspector." It uses **Zod** to ensure that data sent by the user (like an email address) is valid before the backend processes it.
*   **`src/utils/logger.ts`**: The "Black Box Recorder." It uses **Winston** to record everything that happens in the system for debugging.

---

## 2. AI Microservice (`/ai_service`)

### Why is there only one Python file (`app.py`)?

In a professional microservice architecture, we follow the principle of **"Single Responsibility."** 

The Python service is a **Specialized Worker**. Its only job is to perform heavy AI/ML computations (like video summarization or content tagging) that Python handles much better than Node.js.

1.  **Efficiency**: By keeping it in one file (`app.py`) using **FastAPI**, we minimize "overhead." The service starts instantly and has a very small memory footprint.
2.  **Statelessness**: This service doesn't need its own database or complex folder structure because it receives data from the Node.js backend, processes it using AI libraries, and sends the result back immediately.
3.  **Scalability**: If the AI tasks become more complex (e.g., adding deep learning models), we can easily expand this into multiple files. But for the current requirements, a single, high-performance file is the **most efficient** and **senior-level** approach to avoid "Over-Engineering."

---

## 3. Documentation

*   **`backend_design.md`**: The high-level architectural roadmap.
*   **`README_BACKEND.md`**: The quick-start guide for developers.
*   **`LOCAL_SETUP_GUIDE.md`**: The step-by-step manual for running the project on your PC.
