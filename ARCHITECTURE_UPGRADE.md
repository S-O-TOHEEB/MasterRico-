# EduStream Architecture: Senior-Level Upgrade & Comparison

## 1. Executive Summary

After a deep-dive analysis of the project requirements, the existing Node.js/TypeScript foundation, and a comparative review of alternative designs (including Claude's NestJS-based approach), I have formulated a **Level 3: Enterprise-Grade** architecture for EduStream.

This upgrade moves beyond simple CRUD (Create, Read, Update, Delete) into a **Domain-Driven Design (DDD)** that is specifically optimized for high-performance video streaming, social trust-based discovery, and a seamless future frontend integration.

## 2. Competitive Analysis: Manus vs. Claude

| Feature | Manus (Senior Full-Stack) | Claude (NestJS Boilerplate) |
| --- | --- | --- |
| **Framework** | **Modular Express/TS (Performance-First)** | NestJS (Opinionated/Heavier) |
| **Data Strategy** | **TypeORM (Flexible & Scalable)** | Raw SQL (Harder to maintain) |
| **Media Handling** | **Reference-Based (Cloud-Native)** | Mux-Specific (Provider Lock-in) |
| **Search** | **Personalized Trust-Graph** | Basic Full-Text Search |
| **AI Strategy** | **Dedicated Python Microservice** | Simple API wrapper |
| **Frontend Ready** | **Contract-First (Zod + TypeScript)** | Standard DTOs |

---

## 3. Key Architectural Upgrades

### 3.1. The "Trust-Graph" Discovery Engine

Unlike a generic search, EduStream's value lies in "structured learning ranked by your network."

- **Implementation**: I am adding a `Follow` and `TrustConnection` layer.

- **Benefit**: When a learner searches for "Python," the results are weighted by what their respected peers have rated highly, creating a "Discovery Moat" that competitors cannot easily copy.

### 3.2. Financial Integrity (The "Pence" Pattern)

Floating-point math (e.g., `0.1 + 0.2`) is notoriously buggy in software.

- **Implementation**: We are switching all financial columns (Price, Earnings, Payouts) to **Integers (Pence/Cents)**.

- **Benefit**: Zero rounding errors in payouts and commission calculations.

### 3.3. Video-First Content Workflow

A learning platform lives or dies by its video experience.

- **Implementation**: Adding `Sections` and `LessonProgress` tracking.

- **Benefit**: The frontend can now show a "Resume Learning" button and a beautiful curriculum sidebar with progress ticks.

### 3.4. Corporate & B2B Scalability

The market research highlights Corporate Licensing as a major revenue stream in Year 2.

- **Implementation**: Adding `CorporateAccount` and `SeatManagement` entities now.

- **Benefit**: You can sell 100 seats to a company tomorrow without rewriting the backend.

### 3.5. Multi-Gateway Payment Orchestration (Paystack + Stripe)

To dominate the UK and African markets simultaneously, we cannot rely on a single provider.

- **Implementation**: A "Gateway Orchestrator" that automatically routes payments.

- **Benefit**: If a learner pays in **NGN (Naira)** or **ZAR (Rand)**, the system uses **Paystack** for the highest success rate. If they pay in **GBP**, it uses **Stripe**. This minimizes fees and ensures a seamless experience for learners across all target launch markets.

---

## 4. Updated Database Schema (V2)

The new schema includes several critical tables missing from the initial draft:

- **`sections`**: Logical grouping of lessons within a course.

- **`lesson_progress`**: Granular tracking (e.g., "watched 45 seconds of video 3").

- **`trust_connections`**: For the personalized search algorithm.

- **`community_discussions`**: Threaded comments for learner engagement.

- **`corporate_accounts`**: For B2B seat management and SSO readiness.

---

## 5. Seamless Frontend Integration Strategy

As we prepare for the **Figma Design**, the backend is now "Frontend-Aware":

1. **Pagination Utils**: All list endpoints now support `limit`, `offset`, and `totalCount` for smooth infinite scrolling or page navigation.

1. **Image Optimization**: Media entities now support `thumbnails` and `blurhash` for fast, beautiful image loading on the frontend.

1. **Real-time Ready**: The architecture includes a **WebSocket Gateway** for instant notifications when a live class starts or a payment is confirmed.

---

## 6. Next Steps

1. **Finalize the V2 Codebase**: I will now update the entities and services to match this upgraded design.

1. **Figma Readiness**: Once you provide the Figma design, I will map these backend entities directly to your UI components for a 1:1 integration.

