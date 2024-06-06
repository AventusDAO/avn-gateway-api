import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Relayer } from './relayer';
import { Transaction } from './transaction';

@Entity('fee')
export class Fee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  relayerId: number;

  @Column({ type: 'int', nullable: true })
  transactionId: number | null;

  @Column({ type: 'varchar', length: 66, nullable: true })
  userPublicKey: string | null;

  @Column({ type: 'varchar' })
  fee: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ManyToOne(() => Relayer, relayer => relayer.fees, { eager: true })
  relayer: Relayer;

  @ManyToOne(() => Transaction, transaction => transaction.fees, {
    eager: true,
    nullable: true
  })
  transaction: Transaction | null;
}
