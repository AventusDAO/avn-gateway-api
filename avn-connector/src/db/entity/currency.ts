import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { PayerTransaction } from './payerTransaction';
import { Fee } from './fee';
import { Relayer } from './relayer';
import { DefaultRelayerFee } from './defaultRelayerFee';

@Entity('currency')
export class Currency {
  @PrimaryGeneratedColumn()
  currencyId: number;

  @Column({ type: 'varchar', length: 42, unique: true })
  token: string;

  @Column({ type: 'boolean', default: false })
  native: boolean;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(
    () => PayerTransaction,
    payerTransaction => payerTransaction.currency,
    { cascade: true }
  )
  payerTransactions: PayerTransaction[];

  @OneToMany(() => Fee, fee => fee.currency, { cascade: true })
  fees: Fee[];

  @OneToMany(
    () => DefaultRelayerFee,
    defaultRelayerFee => defaultRelayerFee.currency,
    { eager: false }
  )
  defaultFees: DefaultRelayerFee[];
}
