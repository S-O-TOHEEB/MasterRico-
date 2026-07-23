import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Unique } from "typeorm";
import { User } from "./User.js";

@Entity("trust_connections")
@Unique(["followerId", "followingId"])
export class TrustConnection {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  followerId!: string;

  @ManyToOne(() => User)
  follower!: User;

  @Column("uuid")
  followingId!: string;

  @ManyToOne(() => User)
  following!: User;

  @CreateDateColumn({type:"timestamp"})
  createdAt!: Date;
}
