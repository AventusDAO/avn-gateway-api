import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WebhookEndpoint } from './webhookEndpoint';
import { WebhookEvent } from './webhookEvent';

@Entity('webhooks')
export class Webhooks {
    @PrimaryColumn()
    webhookEndpointId: number;

    @PrimaryColumn()
    webhookEventId: number;

    @ManyToOne(() => WebhookEndpoint, webhookEndpoint => webhookEndpoint.webhooks, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'webhookEndpointId', referencedColumnName: 'id' })
    webhookEndpoint: WebhookEndpoint;

    @ManyToOne(() => WebhookEvent, webhookEvent => webhookEvent.webhooks, { cascade: true })
    @JoinColumn({ name: 'webhookEventId', referencedColumnName: 'id' })
    webhookEvent: WebhookEvent;
}
