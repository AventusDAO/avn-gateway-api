import { transactionStatus } from "./constants";

export interface Transaction {
    senderAddress: string;
    senderNonce: string;
    status: string;
    blockNumber: string;
    transactionIndex: string;
    eventArgs: string;
  }

  export const transactionObject: Transaction = {
    senderAddress: 'senderAddress',
    senderNonce: 'senderNonce',
    status: 'status',
    blockNumber: 'blockNumber',
    transactionIndex: 'transactionIndex',
    eventArgs: 'eventArgs',
  };

  
  export type TransactionStatus = typeof transactionStatus[keyof typeof transactionStatus];



export interface LowerData {
    from:string;
    to:string
}