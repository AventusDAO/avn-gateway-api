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
import { Currency } from './currency';

@Entity('payerTransaction')
export class PayerTransaction {
  @PrimaryColumn()
  transactionId: number;

  @PrimaryColumn()
  payerId: number;

  @PrimaryColumn({ default: null }) // Remove default value
  currencyId: number;

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

  @ManyToOne(() => Currency, currency => currency.payerTransactions, {
    eager: false
  })
  currency: Currency;
}
