import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique
} from 'typeorm';
import { Relayer } from './relayer';
import { Currency } from './currency';

@Entity('defaultRelayerFee')
@Unique(['relayerId', 'currencyId'])
export class DefaultRelayerFee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  relayerId: number;

  @Column({ type: 'int' })
  currencyId: number;

  @Column({ type: 'varchar' })
  fee: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Relayer, relayer => relayer.defaultFees, { eager: true })
  relayer: Relayer;

  @ManyToOne(() => Currency, currency => currency.defaultFees, { eager: true })
  currency: Currency;
}
