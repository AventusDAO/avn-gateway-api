import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Payer } from './payer';

@Entity('splitFeeUser')
export class SplitFeeUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  payerId: number;

  @Column({ type: 'varchar', length: 66, unique: true })
  publicKey: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ManyToOne(() => Payer, payer => payer.splitFeeUsers, { eager: false })
  payer: Payer;
}
