## VPC
The Gateway API VPC module is created separate from the AvN VPC. There is an AWS constraint on a scalable Redis solution in the London region. For this reason the Gateway API lives in Ireland.

The VPC must peer into the AvN VPC which will be different for each environment. Eg Sandbox and Dev Gateway APIs will peer into the Dev chain. Public test Gateway will be into the Public test chain etc etc.
