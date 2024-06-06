import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';
import { Fee } from './fee';

@Entity('relayer')
export class Relayer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 66, unique: true })
  publicKey: string;

  @Column({ type: 'varchar' })
  defaultFee: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'uuid', generated: 'uuid' })
  vaultId: string;

  @OneToMany(() => Fee, fee => fee.relayer, { cascade: true })
  fees: Fee[];
}
