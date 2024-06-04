import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Payer } from './payer';
import { Webhooks } from './webhooks';

@Entity('webhook_endpoint')
@Index('IDX_webhookEndpoint_updatedAt', ['updatedAt'])
export class WebhookEndpoint {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true, nullable: false })
    endpoint: string;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @OneToMany(() => Payer, payer => payer.webhookEndpoint)
    payers: Payer[];

    @OneToMany(() => Webhooks, webhook => webhook.webhookEndpoint)
    webhooks: Webhooks[];
}
