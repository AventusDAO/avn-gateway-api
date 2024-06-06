import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Transaction } from './transaction';
import { Payer } from './payer';

@Entity('payer_transaction')
export class PayerTransaction {
  @PrimaryColumn()
  transactionId: number;

  @PrimaryColumn()
  payerId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ManyToOne(() => Transaction, transaction => transaction.payerTransactions, {
    eager: false
  })
  transaction: Transaction;

  @ManyToOne(() => Payer, payer => payer.payerTransactions, { eager: false })
  payer: Payer;
}
