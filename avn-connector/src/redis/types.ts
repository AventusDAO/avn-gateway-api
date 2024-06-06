import { TransactionStatus } from './constants'

export interface Transaction {
  senderAddress: string
  senderNonce: string
  status: string
  blockNumber: string
  transactionIndex: string
  eventArgs: string
}

export const transactionObject: Transaction = {
  senderAddress: 'senderAddress',
  senderNonce: 'senderNonce',
  status: 'status',
  blockNumber: 'blockNumber',
  transactionIndex: 'transactionIndex',
  eventArgs: 'eventArgs'
}