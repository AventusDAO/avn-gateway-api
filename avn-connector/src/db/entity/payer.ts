import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { WebhookEndpoint } from './webhookEndpoint';
import { SplitFeeUser } from './splitFeeUser';
import { PayerTransaction } from './payerTransaction';

@Entity('payer')
export class Payer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 66, unique: true })
  publicKey: string;

  @Column({ type: 'varchar', unique: true })
  cognitoId: string;

  @Column({ type: 'uuid', generated: 'uuid' })
  vaultId: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Column({ type: 'int', nullable: true })
  webhookEndpointId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ManyToOne(() => WebhookEndpoint, webhookEndpoint => webhookEndpoint.payers, {
    nullable: true,
    onDelete: 'SET NULL'
  })
  webhookEndpoint: WebhookEndpoint;

  @OneToMany(() => SplitFeeUser, splitFeeUser => splitFeeUser.payer, {
    cascade: true
  })
  splitFeeUsers: SplitFeeUser[];

  @OneToMany(() => PayerTransaction, payerTransaction => payerTransaction.payer)
  payerTransactions: PayerTransaction[];
}
