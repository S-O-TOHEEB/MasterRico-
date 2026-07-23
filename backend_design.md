# EduStream Backend Design Document

## 1. Introduction

This document outlines the proposed backend architecture, database schema, and API contracts for the EduStream platform. The design prioritizes scalability, maintainability, and performance, leveraging Node.js with TypeScript for core services, PostgreSQL for data persistence, and Python for specialized AI/ML functionalities, as requested by the user. The system aims to support the market entry, growth, and diversification strategies detailed in the EduStream Market Research document [1].

## 2. Backend Architecture

### 2.0. Media & File Storage Strategy

In this architecture, large files such as videos, course materials, and profile pictures are **never stored directly in the database**. Instead, we follow a reference-based storage pattern:

1.  **Storage Provider**: Files are uploaded to an Object Storage service (e.g., AWS S3, Google Cloud Storage, or Cloudflare R2).
2.  **Database References**: The database only stores the **metadata** and the **public/signed URL** of the file.
3.  **Video Streaming**: For videos, we integrate with a specialized streaming service like **Cloudflare Stream** or **AWS Elemental MediaConvert**. The database stores the `video_id` or `playback_url` provided by these services.

This approach ensures the database remains lightweight and the application scales efficiently.


Given the project's ambitious growth plan, a **modular monolith** architecture is proposed for the initial build. This approach allows for rapid development and deployment while maintaining clear separation of concerns, making it easier to refactor into microservices as the platform scales and specific domains require independent scaling or technology stacks. The core application will be built using Node.js and TypeScript.

### 2.1. Core Services and Modules

The backend will be logically divided into several modules, each responsible for a specific domain:

*   **Auth & User Management**: Handles user registration, login, authentication (JWT), authorization (roles: Learner, Creator, Admin), user profiles, and account settings.
*   **Course Management**: Manages courses, lessons, modules, categories, and content metadata. Supports creation, editing, publishing, and searching of educational content.
*   **Live Class Management**: Facilitates scheduling, hosting, and managing live interactive sessions, including integration with video conferencing solutions.
*   **Enrollment & Progress**: Tracks learner enrollment in courses, lesson completion, and overall progress.
*   **Payment & Payouts**: Manages course purchases, subscription payments (Learner Pro, Creator Pro), and creator payouts. Integrates with payment gateways.
*   **Notification Service**: Handles various notifications (email, in-app) for events like course enrollment, live class reminders, and payment confirmations.
*   **Analytics & Reporting**: Collects and processes user activity data, course performance, and financial metrics for reporting and insights.
*   **AI/ML Service (Python)**: A dedicated Python microservice for functionalities like AI-powered content tagging, summary generation, and personalized learning recommendations. This service will communicate with the Node.js backend via a message queue or REST API.
*   **Video Streaming Service**: Manages video uploads, transcoding (e.g., via Cloudflare Stream as mentioned in market research), and secure delivery of video content.
*   **Community & Social**: Manages community forums, discussions, and social features like learning squads and leaderboards.
*   **Certificate Management**: Handles the generation and verification of blockchain-backed certificates.

### 2.2. Technology Stack

*   **Primary Backend**: Node.js, TypeScript, Express.js (or similar framework)
*   **Database**: PostgreSQL
*   **ORM**: TypeORM or Prisma (for TypeScript)
*   **Authentication**: JWT (JSON Web Tokens)
*   **Background Jobs/Queues**: Redis (for job queues and caching)
*   **AI/ML Microservice**: Python, FastAPI/Flask, relevant ML libraries
*   **Containerization**: Docker, Docker Compose
*   **Deployment**: Kubernetes (as suggested by Terraform files in the provided zip)

## 3. Database Schema (PostgreSQL)

The following outlines the core tables and their relationships. Detailed column definitions will be provided during implementation.

### 3.1. `users` Table

Stores user information, including roles (Learner, Creator, Admin).

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the user                |
| `email`        | `VARCHAR(255)`      | `UNIQUE`, `NOT NULL`  | User's email address                          |
| `password_hash`| `VARCHAR(255)`      | `NOT NULL`            | Hashed password                               |
| `first_name`   | `VARCHAR(100)`      | `NOT NULL`            | User's first name                             |
| `last_name`    | `VARCHAR(100)`      | `NOT NULL`            | User's last name                              |
| `role`         | `ENUM('learner', 'creator', 'admin')` | `NOT NULL`, `DEFAULT 'learner'` | User's role on the platform                   |
| `bio`          | `TEXT`              | `NULL`                | Creator's biography                           |
| `profile_picture_url` | `VARCHAR(255)` | `NULL`                | URL to user's profile picture                 |
| `is_active`    | `BOOLEAN`           | `NOT NULL`, `DEFAULT TRUE` | Account status                                |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.2. `courses` Table

Stores information about educational courses.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the course              |
| `creator_id`   | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | Creator of the course                         |
| `title`        | `VARCHAR(255)`      | `NOT NULL`            | Course title                                  |
| `description`  | `TEXT`              | `NOT NULL`            | Detailed course description                   |
| `price`        | `NUMERIC(10, 2)`    | `NOT NULL`, `DEFAULT 0.00` | Course price in GBP                           |
| `currency`     | `VARCHAR(3)`        | `NOT NULL`, `DEFAULT 'GBP'` | Currency of the course price                  |
| `status`       | `ENUM('draft', 'published', 'archived')` | `NOT NULL`, `DEFAULT 'draft'` | Course status                                 |
| `thumbnail_url`| `VARCHAR(255)`      | `NULL`                | URL to course thumbnail image                 |
| `difficulty_level` | `ENUM('beginner', 'intermediate', 'advanced')` | `NULL` | Course difficulty level                       |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.3. `lessons` Table

Stores individual lessons within a course.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the lesson              |
| `course_id`    | `UUID`              | `FOREIGN KEY (courses.id)`, `NOT NULL` | Course the lesson belongs to                  |
| `title`        | `VARCHAR(255)`      | `NOT NULL`            | Lesson title                                  |
| `description`  | `TEXT`              | `NULL`                | Lesson description                            |
| `video_url`    | `VARCHAR(255)`      | `NULL`                | URL to the lesson video                       |
| `duration_seconds` | `INTEGER`       | `NULL`                | Duration of the video in seconds              |
| `order_index`  | `INTEGER`           | `NOT NULL`            | Order of the lesson within the course         |
| `is_previewable` | `BOOLEAN`         | `NOT NULL`, `DEFAULT FALSE` | Whether the lesson can be previewed for free  |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.4. `enrollments` Table

Tracks learner enrollment in courses.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the enrollment          |
| `user_id`      | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | Learner who enrolled                          |
| `course_id`    | `UUID`              | `FOREIGN KEY (courses.id)`, `NOT NULL` | Course enrolled in                            |
| `enrollment_date` | `TIMESTAMP`      | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Date of enrollment                            |
| `completion_date` | `TIMESTAMP`      | `NULL`                | Date of course completion                     |
| `progress_percentage` | `NUMERIC(5, 2)` | `NOT NULL`, `DEFAULT 0.00` | Percentage of course completed                |
| `status`       | `ENUM('in_progress', 'completed', 'dropped')` | `NOT NULL`, `DEFAULT 'in_progress'` | Enrollment status                             |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.5. `payments` Table

Records all payment transactions.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the payment             |
| `user_id`      | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | User making the payment                       |
| `course_id`    | `UUID`              | `FOREIGN KEY (courses.id)`, `NULL` | Course purchased (if applicable)              |
| `subscription_id` | `UUID`           | `NULL`                | Subscription purchased (if applicable)        |
| `amount`       | `NUMERIC(10, 2)`    | `NOT NULL`            | Payment amount                                |
| `currency`     | `VARCHAR(3)`        | `NOT NULL`            | Currency of the payment                       |
| `status`       | `ENUM('pending', 'completed', 'failed', 'refunded')` | `NOT NULL` | Payment status                                |
| `payment_gateway_id` | `VARCHAR(255)` | `NULL`                | Transaction ID from payment gateway           |
| `payment_method` | `VARCHAR(50)`    | `NULL`                | e.g., 'credit_card', 'paypal'                 |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.6. `payouts` Table

Records payouts to creators.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the payout              |
| `creator_id`   | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | Creator receiving the payout                  |
| `amount`       | `NUMERIC(10, 2)`    | `NOT NULL`            | Payout amount                                 |
| `currency`     | `VARCHAR(3)`        | `NOT NULL`            | Currency of the payout                        |
| `status`       | `ENUM('pending', 'completed', 'failed')` | `NOT NULL` | Payout status                                 |
| `payout_method`| `VARCHAR(50)`      | `NULL`                | e.g., 'bank_transfer', 'paypal'               |
| `transaction_id` | `VARCHAR(255)`   | `NULL`                | Transaction ID from payout service            |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.7. `certificates` Table

Stores information about issued certificates.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the certificate         |
| `user_id`      | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | Learner who earned the certificate            |
| `course_id`    | `UUID`              | `FOREIGN KEY (courses.id)`, `NOT NULL` | Course for which certificate was issued       |
| `issue_date`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Date the certificate was issued               |
| `unique_code`  | `VARCHAR(255)`      | `UNIQUE`, `NOT NULL`  | Unique verification code for the certificate  |
| `blockchain_hash` | `VARCHAR(255)`   | `NULL`                | Hash for blockchain verification (if applicable)|
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.8. `live_classes` Table

Manages scheduled live classes.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the live class          |
| `course_id`    | `UUID`              | `FOREIGN KEY (courses.id)`, `NOT NULL` | Course associated with the live class         |
| `creator_id`   | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | Creator hosting the live class                |
| `title`        | `VARCHAR(255)`      | `NOT NULL`            | Live class title                              |
| `description`  | `TEXT`              | `NULL`                | Live class description                        |
| `start_time`   | `TIMESTAMP`         | `NOT NULL`            | Scheduled start time of the live class        |
| `end_time`     | `TIMESTAMP`         | `NOT NULL`            | Scheduled end time of the live class          |
| `meeting_url`  | `VARCHAR(255)`      | `NULL`                | URL for the live meeting (e.g., Zoom, Google Meet)|
| `status`       | `ENUM('scheduled', 'live', 'completed', 'cancelled')` | `NOT NULL`, `DEFAULT 'scheduled'` | Live class status                             |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.9. `subscriptions` Table

Manages Learner Pro and Creator Pro subscriptions.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the subscription        |
| `user_id`      | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | User who holds the subscription               |
| `plan_type`    | `ENUM('learner_pro', 'creator_pro')` | `NOT NULL` | Type of subscription plan                     |
| `start_date`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Subscription start date                       |
| `end_date`     | `TIMESTAMP`         | `NULL`                | Subscription end date (for fixed terms)       |
| `status`       | `ENUM('active', 'cancelled', 'expired')` | `NOT NULL`, `DEFAULT 'active'` | Subscription status                           |
| `auto_renew`   | `BOOLEAN`           | `NOT NULL`, `DEFAULT TRUE` | Whether the subscription auto-renews          |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.10. `categories` Table

For organizing courses into categories.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the category            |
| `name`         | `VARCHAR(100)`      | `UNIQUE`, `NOT NULL`  | Category name (e.g., 'Technology', 'Design')  |
| `description`  | `TEXT`              | `NULL`                | Category description                          |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.11. `course_categories` Junction Table

Many-to-many relationship between courses and categories.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `course_id`    | `UUID`              | `FOREIGN KEY (courses.id)`, `NOT NULL` | Course ID                                     |
| `category_id`  | `UUID`              | `FOREIGN KEY (categories.id)`, `NOT NULL` | Category ID                                   |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

### 3.12. `reviews` Table

Stores course reviews and ratings.

| Column Name    | Data Type           | Constraints           | Description                                   |
| :------------- | :------------------ | :-------------------- | :-------------------------------------------- |
| `id`           | `UUID`              | `PRIMARY KEY`         | Unique identifier for the review              |
| `user_id`      | `UUID`              | `FOREIGN KEY (users.id)`, `NOT NULL` | User who wrote the review                     |
| `course_id`    | `UUID`              | `FOREIGN KEY (courses.id)`, `NOT NULL` | Course being reviewed                         |
| `rating`       | `INTEGER`           | `NOT NULL`, `CHECK (rating >= 1 AND rating <= 5)` | Rating from 1 to 5                            |
| `comment`      | `TEXT`              | `NULL`                | Review comment                                |
| `created_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp                     |
| `updated_at`   | `TIMESTAMP`         | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update timestamp                         |

## 4. API Contracts (RESTful)

The API will be RESTful, using JSON for request and response bodies. Authentication will be handled via JWTs. All endpoints will be prefixed with `/api/v1`.

### 4.1. Authentication & User Endpoints

*   `POST /api/v1/auth/register`: Register a new user.
    *   Request: `{ email, password, first_name, last_name, role }`
    *   Response: `{ token, user: { id, email, first_name, last_name, role } }`
*   `POST /api/v1/auth/login`: Authenticate user and return JWT.
    *   Request: `{ email, password }`
    *   Response: `{ token, user: { id, email, first_name, last_name, role } }`
*   `GET /api/v1/users/me`: Get current authenticated user's profile.
    *   Response: `{ id, email, first_name, last_name, role, bio, profile_picture_url }`
*   `PUT /api/v1/users/me`: Update current authenticated user's profile.
    *   Request: `{ first_name?, last_name?, bio?, profile_picture_url? }`
    *   Response: `{ id, email, first_name, last_name, role, bio, profile_picture_url }`

### 4.2. Course Endpoints

*   `POST /api/v1/courses`: Create a new course (Creator role required).
    *   Request: `{ title, description, price, currency, thumbnail_url, difficulty_level, category_ids[] }`
    *   Response: `{ id, title, description, ... }`
*   `GET /api/v1/courses`: Get a list of all courses (with optional filters/pagination).
    *   Response: `[ { id, title, description, creator: { id, name }, ... } ]`
*   `GET /api/v1/courses/:id`: Get details of a specific course.
    *   Response: `{ id, title, description, lessons: [], reviews: [], ... }`
*   `PUT /api/v1/courses/:id`: Update a course (Creator role, owner of course).
    *   Request: `{ title?, description?, price?, ... }`
    *   Response: `{ id, title, description, ... }`
*   `DELETE /api/v1/courses/:id`: Delete a course (Creator role, owner of course, or Admin).
    *   Response: `{ message: 'Course deleted successfully' }`

### 4.3. Lesson Endpoints

*   `POST /api/v1/courses/:courseId/lessons`: Add a lesson to a course (Creator role, owner of course).
    *   Request: `{ title, description, video_url, duration_seconds, order_index, is_previewable }`
    *   Response: `{ id, title, description, ... }`
*   `PUT /api/v1/courses/:courseId/lessons/:lessonId`: Update a lesson.
    *   Request: `{ title?, description?, ... }`
    *   Response: `{ id, title, description, ... }`
*   `DELETE /api/v1/courses/:courseId/lessons/:lessonId`: Delete a lesson.
    *   Response: `{ message: 'Lesson deleted successfully' }`

### 4.4. Enrollment Endpoints

*   `POST /api/v1/enrollments`: Enroll in a course (Learner role).
    *   Request: `{ course_id }`
    *   Response: `{ id, user_id, course_id, enrollment_date, ... }`
*   `GET /api/v1/enrollments/me`: Get courses enrolled by the current user.
    *   Response: `[ { id, course: { id, title, ... }, progress_percentage, ... } ]`
*   `PUT /api/v1/enrollments/:id/progress`: Update lesson progress for an enrollment.
    *   Request: `{ lesson_id, completed: boolean }`
    *   Response: `{ message: 'Progress updated' }`

### 4.5. Payment Endpoints

*   `POST /api/v1/payments/checkout`: Initiate a checkout for a course or subscription.
    *   Request: `{ item_type: 'course' | 'subscription', item_id, payment_method_details }`
    *   Response: `{ payment_id, status, checkout_url? }`
*   `POST /api/v1/payments/webhook`: Webhook endpoint for payment gateway notifications.
    *   (Internal endpoint, not directly exposed to frontend)

### 4.6. Subscription Endpoints

*   `POST /api/v1/subscriptions`: Create a new subscription.
    *   Request: `{ plan_type, payment_details }`
    *   Response: `{ id, user_id, plan_type, status, ... }`
*   `GET /api/v1/subscriptions/me`: Get current user's subscriptions.
    *   Response: `[ { id, plan_type, status, start_date, end_date, ... } ]`
*   `POST /api/v1/subscriptions/:id/cancel`: Cancel an active subscription.
    *   Response: `{ message: 'Subscription cancelled' }`

### 4.7. AI/ML Service Endpoints (Python Microservice)

*   `POST /api/v1/ai/summarize`: Generate a summary for video content.
    *   Request: `{ video_url }`
    *   Response: `{ summary_text }`
*   `POST /api/v1/ai/tag-content`: Generate tags for course content.
    *   Request: `{ text_content, video_transcript? }`
    *   Response: `{ tags: [] }`

## 5. References

[1]: EduStream Market Research.docx (Provided by user)
