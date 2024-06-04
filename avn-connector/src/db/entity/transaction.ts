import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { PayerTransaction } from './payerTransaction';
import { Fee } from './fee';

@Entity('transaction')
export class Transaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true })
    name: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @OneToMany(() => PayerTransaction, payerTransaction => payerTransaction.transaction, { cascade: true })
    payerTransactions: PayerTransaction[];

    @OneToMany(() => Fee, fee => fee.transaction, { cascade: true })
    fees: Fee[];
}
