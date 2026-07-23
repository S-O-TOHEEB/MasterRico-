import { DataSource } from "typeorm";
import dotenv from "dotenv";

// Original entities
import { User } from "../entities/User.js";
import { Course } from "../entities/Course.js";
import { Section } from "../entities/Section.js";
import { Lesson } from "../entities/Lesson.js";
import { LessonProgress } from "../entities/LessonProgress.js";
import { TrustConnection } from "../entities/TrustConnection.js";
import { Media } from "../entities/Media.js";

// New entities (batch update v2)
import { Enrollment }      from "../entities/Enrollment.js";
import { Review }          from "../entities/Review.js";
import { Subscription }    from "../entities/Subscription.js";
import { Certificate }     from "../entities/Certificate.js";
import { LearningPath }    from "../entities/LearningPath.js";
import { DiscussionPost }    from "../entities/DiscussionPost.js";
import { DiscussionReply }   from "../entities/DiscussionReply.js";
import { Notification }      from "../entities/Notification.js";
import { CorporateAccount }  from "../entities/CorporateAccount.js";
import { CorporateMember }   from "../entities/CorporateMember.js";
import { UserStreak }        from "../entities/UserStreak.js";
import { Badge, UserBadge }  from "../entities/Badge.js";
import { ReferralCode, ReferralConversion } from "../entities/ReferralCode.js";
import { LiveSession, LiveSessionRsvp } from "../entities/LiveSession.js";

// New entities (frontend-gap batch)
import { PaymentMethod }     from "../entities/PaymentMethod.js";
import { PortfolioProject }  from "../entities/PortfolioProject.js";
import { Conversation }      from "../entities/Conversation.js";
import { Message }           from "../entities/Message.js";

// Payments ledger
import { Payment } from "../entities/Payment.js";

dotenv.config();

const entities = [
  User, Course, Section, Lesson, LessonProgress,
  TrustConnection, Media, Enrollment, Review,
  Subscription, Certificate, LearningPath,
  DiscussionPost, DiscussionReply, Notification,
  CorporateAccount, CorporateMember,
  UserStreak, Badge, UserBadge,
  ReferralCode, ReferralConversion,
  LiveSession, LiveSessionRsvp,
  PaymentMethod, PortfolioProject, Conversation, Message,
  Payment,
];

const isProduction = process.env.NODE_ENV === "production";

/**
 * TYPEORM_SYNC controls schema synchronisation:
 *
 *   TYPEORM_SYNC=true  (default) — TypeORM auto-creates / alters tables on
 *                                  startup. Safe for development and the first
 *                                  production deploy. No migration files needed.
 *
 *   TYPEORM_SYNC=false           — Disable once you've generated migration files
 *                                  and want explicit control over schema changes.
 *                                  Run: npm run migration:run  before starting.
 *
 * On Render: set TYPEORM_SYNC=true for initial deploy, then flip to false
 * after running  npm run migration:generate  locally against the Render DB.
 */
const shouldSync = process.env.TYPEORM_SYNC !== "false";

export const AppDataSource = process.env.DATABASE_URL
  ? new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      synchronize: shouldSync,
      logging: false,
      entities,
      migrations: ["dist/migrations/*.js"],
    })
  : new DataSource({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "edustream",
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      synchronize: shouldSync,
      logging: !isProduction,
      entities,
      migrations: ["src/migrations/*.ts"],
    });
