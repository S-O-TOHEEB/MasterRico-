-- EduStream Master Schema (V2 - Enterprise Grade)
-- This SQL script creates the database structure for manual setup.
-- Note: If using TypeORM 'synchronize: true' in development, this is created automatically.

-- 1. Create Database (Run this manually in psql or pgAdmin)
-- CREATE DATABASE edustream;

-- 2. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Enums
CREATE TYPE user_role AS ENUM ('learner', 'creator', 'admin');
CREATE TYPE lesson_type AS ENUM ('video', 'text', 'quiz', 'live');

-- 4. Tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    firstName VARCHAR(100),
    lastName VARCHAR(100),
    role user_role DEFAULT 'learner',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    pricePence INTEGER DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'GBP',
    creatorId UUID REFERENCES users(id),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    orderIndex INTEGER NOT NULL,
    courseId UUID REFERENCES courses(id) ON DELETE CASCADE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type lesson_type DEFAULT 'video',
    videoUrl TEXT,
    durationSeconds INTEGER,
    orderIndex INTEGER NOT NULL,
    isPreviewable BOOLEAN DEFAULT false,
    courseId UUID REFERENCES courses(id) ON DELETE CASCADE,
    sectionId UUID REFERENCES sections(id) ON DELETE SET NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    userId UUID REFERENCES users(id) ON DELETE CASCADE,
    lessonId UUID REFERENCES lessons(id) ON DELETE CASCADE,
    watchedSeconds INTEGER DEFAULT 0,
    isCompleted BOOLEAN DEFAULT false,
    completedAt TIMESTAMP WITH TIME ZONE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(userId, lessonId)
);

CREATE TABLE IF NOT EXISTS trust_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    followerId UUID REFERENCES users(id) ON DELETE CASCADE,
    followingId UUID REFERENCES users(id) ON DELETE CASCADE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(followerId, followingId)
);

CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fileName VARCHAR(255) NOT NULL,
    fileUrl TEXT NOT NULL,
    fileSize INTEGER,
    mimeType VARCHAR(100),
    provider VARCHAR(50) DEFAULT 's3',
    uploadedById UUID REFERENCES users(id),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
