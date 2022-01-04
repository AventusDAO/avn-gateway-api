
module.exports = async ({ options, resolveVariable }) => {
  const stage = await resolveVariable('sls:stage')
  return STAGES[stage]
}

const STAGES = {
  sandbox: {
    region: 'eu-west-1',
    gatewayId: 'ekruq8jkuc',
    awsAccount: '352429414196',
    avnConnectorEndpoint: 'http://avn-connector.sandbox.aventus.internal/',
    blockExplorerUrl: 'https://avn.stargate.aventus.io:3000',
    securityGroup: 'sg-0e8bbe6fd1637aa59',
    subnet1: 'subnet-0fbd9b2001dd48ab2',
    subnet2: 'subnet-02399a3c0dbbddfd9',
    subnet3: 'subnet-0408c56e2665040d5',
    mqBrokerAmpqEndpoint: 'amqps://b-63abcf7c-287c-4e32-82d6-993836a68350.mq.eu-west-1.amazonaws.com:5671',
    mqSecretArn: 'arn:aws:secretsmanager:eu-west-1:352429414196:secret:rabbitmq',
    logRetentionDays: 1
  },
  development: {
    region: 'eu-west-1',
    gatewayId: 'djmoafguv1',
    awsAccount: '602004642405',
    avnConnectorEndpoint: 'http://avn-connector.cba.aventus.internal/',
    blockExplorerUrl: 'https://avn.cba-stargate.aventus.io:3000',
    securityGroup: 'sg-07f570501e7f0214d',
    subnet1: 'subnet-0581074f5997ea000',
    subnet2: 'subnet-029e2c38b9db9a73c',
    subnet3: 'subnet-0e283c1e95f97cd17',
    mqBrokerAmpqEndpoint: 'amqps://b-e3b90bd4-9486-47ba-854a-aef65a9192f3.mq.eu-west-1.amazonaws.com:5671',
    mqSecretArn: 'arn:aws:secretsmanager:eu-west-1:602004642405:secret:rabbitmq-Nc8wYf',
    logRetentionDays: 1
  }
}
