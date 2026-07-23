import { AppDataSource } from "../config/database.js";
import { DiscussionPost, DiscussionCategory } from "../entities/DiscussionPost.js";
import { DiscussionReply } from "../entities/DiscussionReply.js";
import { Enrollment, EnrollmentStatus } from "../entities/Enrollment.js";
import { NotificationService } from "./NotificationService.js";
import { NotificationType } from "../entities/Notification.js";

interface CreatePostDto {
  title: string;
  body: string;
  category?: DiscussionCategory;
  lessonId?: string;
}

interface CreateReplyDto {
  body: string;
}

export class DiscussionService {
  private postRepo        = AppDataSource.getRepository(DiscussionPost);
  private replyRepo       = AppDataSource.getRepository(DiscussionReply);
  private enrollmentRepo  = AppDataSource.getRepository(Enrollment);
  private notifService    = new NotificationService();

  async createPost(
    courseId: string, authorId: string, dto: CreatePostDto
  ): Promise<DiscussionPost> {
    await this.assertEnrolledOrCreator(authorId, courseId);

    const post = this.postRepo.create({
      courseId,
      authorId,
      title:    dto.title,
      body:     dto.body,
      category: dto.category ?? DiscussionCategory.GENERAL,
      lessonId: dto.lessonId,
    });
    return this.postRepo.save(post);
  }

  async listByCourse(
    courseId: string, lessonId?: string, page = 1, limit = 20
  ): Promise<{ posts: DiscussionPost[]; total: number }> {
    const qb = this.postRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.author", "author")
      .where("p.courseId = :courseId", { courseId })
      .andWhere("p.isFlagged = false");

    if (lessonId) qb.andWhere("p.lessonId = :lessonId", { lessonId });

    qb.orderBy("p.isPinned", "DESC")
      .addOrderBy("p.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();
    return { posts, total };
  }

  async getPost(postId: string): Promise<{ post: DiscussionPost; replies: DiscussionReply[] }> {
    const post = await this.postRepo.findOne({
      where: { id: postId },
      relations: ["author"],
    });
    if (!post) throw new Error("Discussion post not found");

    const replies = await this.replyRepo.find({
      where: { postId, isFlagged: false },
      relations: ["author"],
      order: { isAcceptedAnswer: "DESC", upvoteCount: "DESC", createdAt: "ASC" },
    });

    return { post, replies };
  }

  async updatePost(
    postId: string, authorId: string, dto: Partial<CreatePostDto>
  ): Promise<DiscussionPost> {
    const post = await this.postRepo.findOneBy({ id: postId, authorId });
    if (!post) throw new Error("Post not found or access denied");
    Object.assign(post, dto);
    return this.postRepo.save(post);
  }

  async deletePost(postId: string, authorId: string): Promise<void> {
    const post = await this.postRepo.findOneBy({ id: postId, authorId });
    if (!post) throw new Error("Post not found or access denied");
    await this.postRepo.remove(post);
  }

  async upvotePost(postId: string): Promise<DiscussionPost> {
    const post = await this.postRepo.findOneBy({ id: postId });
    if (!post) throw new Error("Post not found");
    post.upvoteCount++;
    return this.postRepo.save(post);
  }

  async addReply(
    postId: string, authorId: string, dto: CreateReplyDto
  ): Promise<DiscussionReply> {
    const post = await this.postRepo.findOne({
      where: { id: postId },
      relations: ["author"],
    });
    if (!post) throw new Error("Post not found");

    await this.assertEnrolledOrCreator(authorId, post.courseId);

    const reply = this.replyRepo.create({ postId, authorId, body: dto.body });
    const saved = await this.replyRepo.save(reply);

    // Bump reply count on post
    await this.postRepo.increment({ id: postId }, "replyCount", 1);

    // Notify post author if someone else replied
    if (post.authorId !== authorId) {
      await this.notifService.create(post.authorId, {
        type:         NotificationType.NEW_REPLY,
        title:        "New reply on your post",
        message:      `Someone replied to your discussion: "${post.title}"`,
        resourceId:   postId,
        resourceType: "discussion_post",
      });
    }

    return saved;
  }

  async updateReply(
    replyId: string, authorId: string, body: string
  ): Promise<DiscussionReply> {
    const reply = await this.replyRepo.findOneBy({ id: replyId, authorId });
    if (!reply) throw new Error("Reply not found or access denied");
    reply.body = body;
    return this.replyRepo.save(reply);
  }

  async deleteReply(replyId: string, authorId: string): Promise<void> {
    const reply = await this.replyRepo.findOneBy({ id: replyId, authorId });
    if (!reply) throw new Error("Reply not found or access denied");
    await this.replyRepo.remove(reply);
    await this.postRepo.decrement({ id: reply.postId }, "replyCount", 1);
  }

  async markAcceptedAnswer(
    replyId: string, requesterId: string
  ): Promise<DiscussionReply> {
    const reply = await this.replyRepo.findOne({
      where: { id: replyId },
      relations: ["post"],
    });
    if (!reply) throw new Error("Reply not found");

    // Resolve courseId from the post itself (not from route params)
    const courseId     = reply.post.courseId;
    // Only post author or enrolled user can mark accepted answer
    const isPostAuthor = reply.post.authorId === requesterId;
    const enrollment   = await this.enrollmentRepo.findOneBy({ userId: requesterId, courseId });
    if (!isPostAuthor && !enrollment) throw new Error("Access denied");

    // Clear any existing accepted answer on this post
    await this.replyRepo.update({ postId: reply.postId, isAcceptedAnswer: true }, { isAcceptedAnswer: false });

    reply.isAcceptedAnswer = true;
    const saved = await this.replyRepo.save(reply);

    await this.postRepo.update(reply.postId, { isResolved: true });
    return saved;
  }

  async pinPost(postId: string): Promise<DiscussionPost> {
    const post = await this.postRepo.findOneBy({ id: postId });
    if (!post) throw new Error("Post not found");
    post.isPinned = !post.isPinned;
    return this.postRepo.save(post);
  }

  // ── Reporting + admin moderation queue ──────────────────────────────────────

  /** Flagging hides the post from listByCourse/getPost immediately, pending admin review. */
  async reportPost(postId: string): Promise<void> {
    const post = await this.postRepo.findOneBy({ id: postId });
    if (!post) throw new Error("Post not found");
    post.isFlagged = true;
    await this.postRepo.save(post);
  }

  async reportReply(replyId: string): Promise<void> {
    const reply = await this.replyRepo.findOneBy({ id: replyId });
    if (!reply) throw new Error("Reply not found");
    reply.isFlagged = true;
    await this.replyRepo.save(reply);
  }

  async listFlaggedPosts(page = 1, limit = 20): Promise<{ posts: DiscussionPost[]; total: number }> {
    const [posts, total] = await this.postRepo.findAndCount({
      where: { isFlagged: true },
      relations: ["author", "course"],
      order: { updatedAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { posts, total };
  }

  async listFlaggedReplies(page = 1, limit = 20): Promise<{ replies: DiscussionReply[]; total: number }> {
    const [replies, total] = await this.replyRepo.findAndCount({
      where: { isFlagged: true },
      relations: ["author", "post"],
      order: { updatedAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { replies, total };
  }

  async unflagPost(postId: string): Promise<DiscussionPost> {
    const post = await this.postRepo.findOneBy({ id: postId });
    if (!post) throw new Error("Post not found");
    post.isFlagged = false;
    return this.postRepo.save(post);
  }

  async unflagReply(replyId: string): Promise<DiscussionReply> {
    const reply = await this.replyRepo.findOneBy({ id: replyId });
    if (!reply) throw new Error("Reply not found");
    reply.isFlagged = false;
    return this.replyRepo.save(reply);
  }

  /** Admin hard-delete of a flagged post (and its replies) — bypasses the authorId ownership check deletePost() enforces. */
  async adminDeletePost(postId: string): Promise<void> {
    const post = await this.postRepo.findOneBy({ id: postId });
    if (!post) throw new Error("Post not found");
    await this.replyRepo.delete({ postId });
    await this.postRepo.remove(post);
  }

  /** Admin hard-delete of a flagged reply — bypasses the authorId ownership check deleteReply() enforces. */
  async adminDeleteReply(replyId: string): Promise<void> {
    const reply = await this.replyRepo.findOneBy({ id: replyId });
    if (!reply) throw new Error("Reply not found");
    await this.replyRepo.remove(reply);
    await this.postRepo.decrement({ id: reply.postId }, "replyCount", 1);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async assertEnrolledOrCreator(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOneBy({ userId, courseId });
    const enrolled = enrollment?.status === EnrollmentStatus.ACTIVE ||
                     enrollment?.status === EnrollmentStatus.COMPLETED;
    if (!enrolled) throw new Error("Must be enrolled to participate in discussions");
  }
}
