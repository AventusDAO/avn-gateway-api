## Overview
Layers (code shared between lambdas) are contained in folders (eg: `common/`)

Lambdas are contained in `*-handler.js` files (eg: `poll-handler.js`)

## Debugging
To debug an issue with the lambda's or the connector you can use AWS cloudwatch to trace the flow of a transaction using its `requestId` by following these steps:
 - Log in to AWS and go to CloudWatch
 - Under `Logs` (from the left hand menu) select `Logs Insights`
 - Select the log groups you are interested in from the drop down. You can select more than 1
    - the connector logs are found in `/aws/eks/fluentbit-cloudwatch/logs`
 - Update the query to filter by your requestId
 - Click `Run query`

**Example query:**

Select the following log groups:
 - /aws/eks/fluentbit-cloudwatch/logs
 - /aws/lambda/send-handler
 - /aws/lambda/split-fee-handler
 - /aws/lambda/tx-dispatch-handler
 - /aws/lambda/invalid-transaction-handler

and use this query:
```
fields @timestamp, @message, @log, @logStream
| sort @timestamp desc
| filter @message =~ "49f18d8f-130c-4d67-b793-13f010c235fa"
```

To see the end to end flow of a particular requestId.