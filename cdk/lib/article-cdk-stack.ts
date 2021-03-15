import * as cdk from "@aws-cdk/core";
import * as kinesis from "@aws-cdk/aws-kinesis";
import * as iam from "@aws-cdk/aws-iam";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as sfn from "@aws-cdk/aws-stepfunctions";
import * as tasks from "@aws-cdk/aws-stepfunctions-tasks";
import * as lambda from "@aws-cdk/aws-lambda";
import * as apiGateway from "@aws-cdk/aws-apigateway";
import * as athena from "@aws-cdk/aws-athena";
import * as glue from "@aws-cdk/aws-glue";
import { v4 as uuidv4 } from "uuid";
import * as resourceBucketS3 from "../resources/bucketS3";
import * as resourceDynamoDB from "../resources/dynamoDB";
import * as kda from "@aws-cdk/aws-kinesisanalytics";
import * as firehose from "@aws-cdk/aws-kinesisfirehose";
import * as sns from '@aws-cdk/aws-sns';
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import * as ses from '@aws-cdk/aws-ses';

import { DynamoEventSource, KinesisEventSource } from "@aws-cdk/aws-lambda-event-sources";

import path = require("path");
import { IFunction } from "@aws-cdk/aws-lambda";

import * as config from "../configParameters.json";
import * as dynamocnf from "./lambdas/src/config.json";
import * as fs from "fs";
import { exit } from "process";
import { Duration } from "@aws-cdk/core";

export class ArticleCdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    global.Buffer = global.Buffer || require("buffer").Buffer;

    //Tag resources of the cdk
    cdk.Tags.of(scope).add("project", "samarkand")

    //Declaration of common variables
    const region = config.region;
    const accountId = config.accountId;
    const resourcesPrefix = config.resourcesPrefix;

    //Resources Names
    const lexDataStreamName = `${resourcesPrefix}-lexDataStream`;
    const lexDataStreamToAudioName = `${resourcesPrefix}-lexDataStreamToAudio`;
    const sentimentResultStreamName = `${dynamocnf.aws.KDS.sentimentResult}`;
    const messagesBucketName = `${config.resourcesPrefix}-bucket`;
    const athenaResultsBucketName = `${config.resourcesPrefix}-athena-bucket`;
    const lambdaSentimentResultToKDS = `${resourcesPrefix}-sentimentToKDS`;
    const lambdaGetIntent = `${resourcesPrefix}-getIntent`;
    const stepFnProcessLex = `${resourcesPrefix}-ProcessLex`;
    const stepFnSentimentResultToKDS = `${resourcesPrefix}-sentimentResultToKDS`;
    const stepFnProcessKinesisWithLex = `${resourcesPrefix}-processKinesisWithLex`;
    const lambdaStartStepFunctionName = `${resourcesPrefix}-startStepFunction`;
    const lambdaTranscribeSpeechToTextName = `${resourcesPrefix}-transcribeSpeechToText`;
    const stepFnSpeechToTextName = `${resourcesPrefix}-speechToText`;
    const stepFnDataMappingName = `${resourcesPrefix}-dataMapping`;
    const stepFnTranscribedTextToKinesisName = `${resourcesPrefix}-transcribedTextToKinesis`;
    const stepFnProcessKinesistoAudioName = `${resourcesPrefix}-processKinesistoAudio`;
    const lambdaStartStepFunctionToAudioName = `${resourcesPrefix}-startStepFunctionToAudio`;
    const apiName = `${resourcesPrefix}-Api`;
    const lambdaTrainBotName = `${resourcesPrefix}-trainBot`;
    const lambdaPersistSentimentIntoDynamodb = `${resourcesPrefix}-persistSentimentIntoDynamodbFromKds`;
    const firehoseName = `${resourcesPrefix}-saveToS3`;
    const fireHoseRoleName = `${resourcesPrefix}-firehoseRole`;
    const athenaCatalogName = `${resourcesPrefix}-athenaCatalog`;
    const athenaWorkGroupName = `${resourcesPrefix}-athenaPrimary`;
    const glueRoleName = `${resourcesPrefix}-glueServiceRole`;
    const glueBucketPolicyName = `${resourcesPrefix}-glueBucketPolicy`;
    const glueDatabaseName = `${resourcesPrefix}-database`;
    const glueTableName = `${resourcesPrefix}-sentiment-table`;
    const glueCrawlerUserName = `${resourcesPrefix}-userCrawler`;
    const glueCrawlerSentimentsName = `${resourcesPrefix}-sentimentsCrawler`;
    const notificationSystemName = `${resourcesPrefix}-notification-system`;
    const kinesisApplicationRoleName = `${resourcesPrefix}-kinesisApplicationRole`;
    const notificationsOutputStreamName = `${resourcesPrefix}-notificationsOutputStream`;
    const applicationOutputStreamName = `${resourcesPrefix}-applicationOutputStream`;
    const startStepFunctionNotificationLambdaName = `${resourcesPrefix}-startSfNotification`;
    const retrieveUserDataLambdaName = `${resourcesPrefix}-retrieveUserData`;
    const sendEmailLambdaName = `${resourcesPrefix}-sendEmail`;
    const publishSentimentNotificationLambdaName = `${resourcesPrefix}-publishSentimentNotification`;
    const notificationsStepFnName = `${resourcesPrefix}-Notifications`;
    const retrieveUserDataTaskName = `${resourcesPrefix}-retrieveUserDataTask`;
    const sendNotificationTaskName = `${resourcesPrefix}-sendNotificationTask`;
    const sendEmailTaskName = `${resourcesPrefix}-sendEmailTask`;
    const snsNotificationsTopicName = `${resourcesPrefix}-notificationsTopic`;
    const sesNotificationsTemplateName = `${dynamocnf.aws.SES.sesNotificationsTemplateName}`;
    const invokeLambdaManagedPolicyName = `${config.resourcesPrefix}-invoke_lambda`;
    const notificationPolicyName = `kinesis-analytics-${kinesisApplicationRoleName}-${config.region}`
    const notificationAltPolicyName = `kinesis-analytics-${kinesisApplicationRoleName}-${config.region}-alt`
    const emailSubcription = `${dynamocnf.aws.SNS.emailSubscription}`;
    const syncDynamoS3Name = `${resourcesPrefix}-sync-dynamo-s3`;

    const negativeMessageEmailSubject = "Negative feelings alert!";

    //Execution Role
    const executeRole = new iam.Role(this, "role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    // DynamoDB
    const createTables = async () => {
      const feelingTable = {
        tableName: `${dynamocnf.aws.dynamoDB.feelingTable.name}`,
        partitionKeyName: "id",
        partitionKeyType: dynamodb.AttributeType.STRING,
        sortKeyName: "dateTime",
        sortKeyType: dynamodb.AttributeType.NUMBER,
      };
      resourceDynamoDB.createTable(this, feelingTable);
    };
    createTables();

    const userTable = new dynamodb.Table(this, dynamocnf.aws.dynamoDB.userTable.name, {
      tableName: `${dynamocnf.aws.dynamoDB.userTable.name}`,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      stream: dynamodb.StreamViewType.NEW_IMAGE
    });

    // KDS
    const lexDataStream = new kinesis.Stream(this, lexDataStreamName, {
      streamName: lexDataStreamName,
    });

    lexDataStream.grantReadWrite(executeRole);

    // KDS to audio
    const lexDataStreamToAudio = new kinesis.Stream(
      this,
      lexDataStreamToAudioName,
      {
        streamName: lexDataStreamToAudioName,
      }
    );

    lexDataStreamToAudio.grantReadWrite(executeRole);

    // sentiment result KDS
    const sentimentResultStream = new kinesis.Stream(this, sentimentResultStreamName, {
      streamName: sentimentResultStreamName,
    });

    sentimentResultStream.grantReadWrite(executeRole);

    resourceBucketS3.createBucket(this, { name: messagesBucketName });

    resourceBucketS3.createBucket(this, { name: athenaResultsBucketName });

    //Athena
    const athenaCatalog = new athena.CfnDataCatalog(this, athenaCatalogName, {
      name: athenaCatalogName,
      type: "GLUE",
      parameters: {
        "catalog-id": accountId
      }
    });

    const workGroup = new athena.CfnWorkGroup(this, athenaWorkGroupName, {
      name: athenaWorkGroupName,
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${athenaResultsBucketName}/`
        }
      }
    });

    //Glue
    const glueRole = new iam.CfnRole(this, glueRoleName, {
      roleName: glueRoleName,
      assumeRolePolicyDocument: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": {
              "Service": [
                "glue.amazonaws.com"
              ]
            },
            "Action": [
              "sts:AssumeRole"
            ]
          }
        ]
      },
      managedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"],
      policies: [
        {
          policyName: `${glueBucketPolicyName}`,
          policyDocument: {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Sid": "VisualEditor1",
                "Effect": "Allow",
                "Action": [
                  "s3:PutObject",
                  "s3:GetObject"
                ],
                "Resource": `arn:aws:s3:::${messagesBucketName}/*/*`
              }
            ]
          }
        }
      ]
    });

    const glueDatabase = new glue.CfnDatabase(this, glueDatabaseName, {
      catalogId: accountId,
      databaseInput: {
        name: glueDatabaseName
      }
    });

    const glueTable = new glue.CfnTable(this, glueTableName, {

      catalogId: accountId,
      databaseName: glueDatabaseName,
      tableInput: {
        name: "sentiments",
        parameters: {
          classification: "parquet"
        },
        storageDescriptor: {
          location: `s3://${messagesBucketName}/sentiments/`,
          inputFormat: "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
          outputFormat: "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
          compressed: false,
          numberOfBuckets: 0,
          serdeInfo: {
            serializationLibrary: "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe",
            parameters: {
              "serialization.format": "1"
            }
          },
          columns: [
            {
              name: "id",
              type: "string",
            },
            {
              name: "inputtext",
              type: "string",
            },
            {
              name: "audiourl",
              type: "string",
            },
            {
              name: "lexresult",
              type: "struct<Payload:struct<intentName:string>>",
            },
            {
              name: "recognizedby",
              type: "string",
            },
            {
              name: "datetime",
              type: "timestamp",
            },
            {
              name: "userid",
              type: "string",
            },
            {
              name: "location",
              type: "struct<country:string,latitude:decimal,longitude:decimal>",
            },
          ]
        }
      }
    });
    glueTable.addDependsOn(glueDatabase)


    const crawlerUser = new glue.CfnCrawler(this, glueCrawlerUserName, {
      databaseName: glueDatabaseName,
      name: glueCrawlerUserName,
      role: `${glueRoleName}`,
      targets: {
        s3Targets: [{ path: `s3://${messagesBucketName}/users` }]
      }
    })
    crawlerUser.addDependsOn(glueRole);

    const crawlerSentiments = new glue.CfnCrawler(this, glueCrawlerSentimentsName, {
      databaseName: glueDatabaseName,
      name: glueCrawlerSentimentsName,
      role: `${glueRoleName}`,
      targets: {
        s3Targets: [{ path: `s3://${messagesBucketName}/sentiments` }]
      }
    })
    crawlerSentiments.addDependsOn(glueRole);

    //Lambdas
    // //Participant Feelings by id  
    const getUserFeelings = new lambda.Function(this, "getUserFeelings", {
      functionName: `${resourcesPrefix}getUserFeelings`,
      runtime: lambda.Runtime.NODEJS_10_X,
      timeout: cdk.Duration.minutes(2),
      handler: "handlers/feelings/getUserFeelings.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")),
    });

    getUserFeelings.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "dynamodb:GetRecords",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:Query",
        ],
        resources: [
          `arn:aws:dynamodb:${region}:${accountId}:table/${dynamocnf.aws.dynamoDB.feelingTable.name}`,
        ],
      })
    );

    // Lambda to save feeling to dynamoDB
    const persistSentimentIntoDynamodb = new lambda.Function(this, "persistSentimentIntoDynamodbFromKds", {
      functionName: lambdaPersistSentimentIntoDynamodb,
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: "handlers/sentimentResult/persistSentimentIntoDynamodbFromKds.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // relative to where cdk is executed
      timeout: cdk.Duration.minutes(1),
    });

    const kinesisEventSourceSentimentResult = new KinesisEventSource(sentimentResultStream, {
      startingPosition: lambda.StartingPosition.LATEST,
    });

    persistSentimentIntoDynamodb.addEventSource(kinesisEventSourceSentimentResult);

    persistSentimentIntoDynamodb.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["dynamodb:PutItem", "dynamodb:Query"],
        resources: [
          `arn:aws:dynamodb:${region}:${accountId}:table/${dynamocnf.aws.dynamoDB.feelingTable.name}`,
        ],
      })
    );

    // Lambda to send to KDS
    const sendResultToKDS = new lambda.Function(this, lambdaSentimentResultToKDS, {
      functionName: lambdaSentimentResultToKDS,
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: "handlers/feelings/sentimentResultToKDS.handler",
      timeout: cdk.Duration.seconds(10),
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // relative to where cdk is executed
    });

    sendResultToKDS.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["kinesis:PutRecord"],
        resources: [
          `arn:aws:kinesis:${region}:${accountId}:stream/${sentimentResultStream.streamName}`,
        ],
      })
    );

    // Lambda to process feeling
    const getIntent = new lambda.Function(this, lambdaGetIntent, {
      functionName: lambdaGetIntent,
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: "handlers/getIntent/getIntentHandler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // relative to where cdk is executed
    });

    getIntent.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["lex:*"],
        resources: ["*"],
      })
    );

    // Step Function definition
    const processLex = new sfn.Task(this, stepFnProcessLex, {
      task: new tasks.RunLambdaTask(getIntent),
      resultPath: "$.lexResult",
    });

    const comprehend = new sfn.Pass(this, "Comprehend", {
      parameters: {
        id: uuidv4(),
        "inputText.$": "$.inputText",
        "userId.$": "$.userId",
        "audioUrl.$": "$.audioUrl",
        "location.$": "$.location",
        recognizedBy: "comprehend",
        lexResult: {
          Payload: {
            "intentName.$":
              "$.lexResult.Payload.sentimentResponse.sentimentLabel",
          },
        },
      },
    });

    const recognixedByLex = new sfn.Pass(this, "Recognized by LEX", {
      parameters: {
        id: uuidv4(),
        "inputText.$": "$.inputText",
        "userId.$": "$.userId",
        "audioUrl.$": "$.audioUrl",
        "location.$": "$.location",
        recognizedBy: "lex",
        "lexResult.$": "$.lexResult",
      },
    });

    const sentimentResultToKDS = new tasks.LambdaInvoke(this, stepFnSentimentResultToKDS, {
      lambdaFunction: sendResultToKDS,
      resultPath: "$.saveResponse", //NOT QUITE SURE IF THIS IS CORRECT, PLEASE PROVIDE FEEDBACK DURING PR REVISION
    });

    recognixedByLex.next(sentimentResultToKDS);
    comprehend.next(sentimentResultToKDS);

    let definition = processLex.next(
      new sfn.Choice(this, "Intent is not null?")
        .when(
          sfn.Condition.stringGreaterThanEquals(
            "$.lexResult.Payload.intentName",
            ""
          ),
          recognixedByLex
        )
        .otherwise(comprehend)
    );

    const processKinesisWithLex = new sfn.StateMachine(
      this,
      stepFnProcessKinesisWithLex,
      {
        stateMachineName: stepFnProcessKinesisWithLex,
        definition,
        timeout: cdk.Duration.seconds(30),
      }
    );

    processKinesisWithLex.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction", "lambda:InvokeFunction"],
        resources: [
          `arn:aws:lambda:${region}:${accountId}:function:${getIntent.functionName}`,
        ],
      })
    );

    // Lambda to start Step Function
    const kinesisEventSource = new KinesisEventSource(lexDataStream, {
      startingPosition: lambda.StartingPosition.LATEST,
    });

    const startStepFunction = new lambda.Function(
      this,
      lambdaStartStepFunctionName,
      {
        functionName: lambdaStartStepFunctionName,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: "handlers/stepFunctions/startStepFunctionHandler.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // relative to where cdk is executed

        environment: {
          STEP_FUNCTION_ARN: processKinesisWithLex.stateMachineArn,
        },
      }
    );

    startStepFunction.addEventSource(kinesisEventSource);

    startStepFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:*"],
        resources: ["*"],
      })
    );

    // Lambda to transcribe speech to text
    const transcribeSpeechToText = new lambda.Function(
      this,
      lambdaTranscribeSpeechToTextName,
      {
        functionName: lambdaTranscribeSpeechToTextName,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: "handlers/transcribeToText/speechToText.handler",
        timeout: cdk.Duration.minutes(6),
        code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // relative to where cdk is executed
      }
    );

    transcribeSpeechToText.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:*"],
        resources: ["arn:aws:s3:::*/*"],
      })
    );

    transcribeSpeechToText.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "transcribe:GetTranscriptionJob",
          "transcribe:StartTranscriptionJob",
        ],
        resources: ["*"],
      })
    );

    // Lambda to execute step function with text transcribed
    const sendTranscribedTextToKinesis = new lambda.Function(
      this,
      "sendTranscribedTextToKinesis",
      {
        functionName: `${resourcesPrefix}sendTranscribedTextToKinesis`,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler: "handlers/transcribeToText/sendTranscribedTextToKinesis.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // relative to where cdk is executed
      }
    );

    sendTranscribedTextToKinesis.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:StartExecution"],
        resources: ["arn:aws:states:*:*:stateMachine:*"],
      })
    );

    // Step Function definition to Audio
    const speechToText = new sfn.Task(this, stepFnSpeechToTextName, {
      task: new tasks.RunLambdaTask(transcribeSpeechToText),
      resultPath: "$.transcribeResult",
    });

    const dataMapping = new sfn.Pass(this, stepFnDataMappingName, {
      parameters: {
        "inputText.$": "$.transcribeResult.Payload",
        "audioUrl.$": "$.audioUrl",
        bucketName: messagesBucketName,
        "userId.$": "$.userId",
      },
    });
    //speechToText.next(dataMapping);

    const transcribedTextToKinesis = new sfn.Task(
      this,
      stepFnTranscribedTextToKinesisName,
      {
        task: new tasks.RunLambdaTask(sendTranscribedTextToKinesis),
        resultPath: "$.transcribeResult",
      }
    );
    //dataMapping.next(toStepFunctionText);

    definition = speechToText.next(dataMapping).next(transcribedTextToKinesis);

    const processKinesistoAudio = new sfn.StateMachine(
      this,
      stepFnProcessKinesistoAudioName,
      {
        stateMachineName: stepFnProcessKinesistoAudioName,
        definition,
        timeout: cdk.Duration.seconds(300),
      }
    );

    processKinesistoAudio.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction", "lambda:InvokeFunction"],
        resources: [
          `arn:aws:lambda:${region}:${accountId}:function:${getIntent.functionName}`,
        ],
      })
    );

    // Lambda to start Step Function to Audio
    const kinesisToAudioEventSource = new KinesisEventSource(
      lexDataStreamToAudio,
      {
        startingPosition: lambda.StartingPosition.LATEST,
      }
    );

    const startStepFunctionToAudio = new lambda.Function(
      this,
      lambdaStartStepFunctionToAudioName,
      {
        functionName: lambdaStartStepFunctionToAudioName,
        runtime: lambda.Runtime.NODEJS_10_X,
        handler:
          "handlers/stepFunctions/startStepFunctionToAudioHandler.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // relative to where cdk is executed
        environment: {
          STEP_FUNCTION_ARN: processKinesistoAudio.stateMachineArn,
        },
      }
    );

    startStepFunctionToAudio.addEventSource(kinesisToAudioEventSource);

    startStepFunctionToAudio.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:*", "s3:*"],
        resources: ["*", "arn:aws:s3:::*"],
      })
    );

    // Train BOT
    const trainBot = new lambda.Function(this, lambdaTrainBotName, {
      functionName: lambdaTrainBotName,
      runtime: lambda.Runtime.NODEJS_10_X,
      timeout: cdk.Duration.minutes(2),
      handler: "handlers/messages/rateMessage.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")), // TODO: modify to copy automatically the API project to lib
    });

    trainBot.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "lex:GetBot",
          "lex:GetIntent",
          "lex:PutIntent",
          "lex:PutBot",
          "lex:GetSlotType",
          "s3:DeleteObject",
          "s3:DeleteBucket",
          "lex:PutSlotType",
          "lex:GetIntentVersions",
          "lex:GetSlotType",
          "lex:GetSlotTypeVersions",
        ],
        resources: [
          `arn:aws:dynamodb:${region}:${accountId}:table/Group`,
          `arn:aws:lex:${region}:${accountId}:bot:FeelingTracker:FeelingTracker`,
          `arn:aws:lex:${region}:${accountId}:intent:*:*`,
          `arn:aws:lex:${region}:${accountId}:bot:FeelingTracker:$LATEST`,
          `arn:aws:lex:${region}:${accountId}:slottype:*:*`,
          `arn:aws:s3:::${messagesBucketName}`,
          `arn:aws:s3:::${messagesBucketName}/*`,
          `arn:aws:lex:${region}:${accountId}:intent:*:*`,
        ],
      })
    );

    // API Gateway
    const APIMethod = {
      GET: "GET",
      POST: "POST",
      PUT: "PUT",
      DELETE: "DELETE",
      PATCH: "PATCH",
    };

    const api: apiGateway.RestApi = new apiGateway.RestApi(this, apiName, {
      restApiName: apiName,
    });

    const setAPITrigger = (
      api: apiGateway.RestApi,
      apiPath: string,
      APIMethod: string,
      handler: IFunction
    ) => {
      const lambdaIntegration = new apiGateway.LambdaIntegration(handler);

      const resource = api.root.resourceForPath(apiPath);

      resource.addMethod(APIMethod, lambdaIntegration);
    };

    const setAPIProxyKinesis = (
      api: apiGateway.RestApi,
      apiPath: string,
      APIMethod: string,
      streamName: string,
      encode: boolean
    ) => {
      const requestTemplate = {
        StreamName: streamName,
        Data: "$util.base64Encode($input.json('$.Data'))",
        // [TODO] Removed old, commented code. If you need this code, please check repository history.
        PartitionKey: streamName,
      };

      const kinesisIntegration = new apiGateway.AwsIntegration({
        service: "kinesis",
        action: "PutRecord",
        subdomain: "",
        integrationHttpMethod: "POST",
        options: {
          credentialsRole: executeRole,
          requestTemplates: {
            ["application/json"]: JSON.stringify(requestTemplate),
          },
          integrationResponses: [
            {
              statusCode: "200",
            },
          ],
        },
      });

      const resource = api.root.resourceForPath(apiPath);

      resource.addMethod(APIMethod, kinesisIntegration, {
        methodResponses: [
          {
            statusCode: "200",
            responseModels: {
              "application/json": { modelId: "Empty" },
            },
          },
        ],
      });
    };

    setAPITrigger(api, "messages/train", APIMethod.POST, trainBot);

    setAPITrigger(
      api,
      "feelings/user/{userId}",
      APIMethod.GET,
      getUserFeelings
    );

    setAPIProxyKinesis(
      api,
      "feelings/text",
      APIMethod.PUT,
      lexDataStreamName,
      true
    );

    setAPIProxyKinesis(
      api,
      "feelings/audio",
      APIMethod.PUT,
      lexDataStreamToAudioName,
      true
    );

    //Firehose
    const firehoseRole = new iam.CfnRole(this, fireHoseRoleName, {
      roleName: fireHoseRoleName,
      assumeRolePolicyDocument: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": {
              "Service": [
                "firehose.amazonaws.com"
              ]
            },
            "Action": [
              "sts:AssumeRole"
            ]
          }
        ]
      },
      policies: [
        {
          policyName: `${fireHoseRoleName}-policy`,
          policyDocument: {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Sid": "",
                "Effect": "Allow",
                "Action": [
                  "glue:GetTable",
                  "glue:GetTableVersion",
                  "glue:GetTableVersions"
                ],
                "Resource": [
                  `arn:aws:glue:${region}:${accountId}:catalog`,
                  `arn:aws:glue:${region}:${accountId}:database/${glueDatabaseName}`,
                  `arn:aws:glue:${region}:${accountId}:table/${glueDatabaseName}/sentiments`
                ]
              },
              {
                "Sid": "",
                "Effect": "Allow",
                "Action": [
                  "s3:AbortMultipartUpload",
                  "s3:GetBucketLocation",
                  "s3:GetObject",
                  "s3:ListBucket",
                  "s3:ListBucketMultipartUploads",
                  "s3:PutObject"
                ],
                "Resource": [
                  `arn:aws:s3:::${messagesBucketName}*`,
                  `arn:aws:s3:::${messagesBucketName}/*`
                ]
              },
              {
                "Sid": "",
                "Effect": "Allow",
                "Action": [
                  "lambda:InvokeFunction",
                  "lambda:GetFunctionConfiguration"
                ],
                "Resource": `arn:aws:lambda:${region}:${accountId}:function:%FIREHOSE_POLICY_TEMPLATE_PLACEHOLDER%`
              },
              {
                "Effect": "Allow",
                "Action": [
                  "kms:GenerateDataKey",
                  "kms:Decrypt"
                ],
                "Resource": [
                  `arn:aws:kms:${region}:${accountId}:key/%FIREHOSE_POLICY_TEMPLATE_PLACEHOLDER%`
                ],
                "Condition": {
                  "StringEquals": {
                    "kms:ViaService": `s3.${config.region}.amazonaws.com`
                  },
                  "StringLike": {
                    "kms:EncryptionContext:aws:s3:arn": [
                      "arn:aws:s3:::%FIREHOSE_POLICY_TEMPLATE_PLACEHOLDER%/*"
                    ]
                  }
                }
              },
              {
                "Sid": "",
                "Effect": "Allow",
                "Action": [
                  "logs:PutLogEvents"
                ],
                "Resource": [
                  `arn:aws:logs:${region}:${accountId}:log-group:/aws/kinesisfirehose/${firehoseName}:log-stream:*`
                ]
              },
              {
                "Sid": "",
                "Effect": "Allow",
                "Action": [
                  "kinesis:DescribeStream",
                  "kinesis:GetShardIterator",
                  "kinesis:GetRecords",
                  "kinesis:ListShards"
                ],
                "Resource": `arn:aws:kinesis:${region}:${accountId}:stream/${sentimentResultStreamName}`
              },
              {
                "Effect": "Allow",
                "Action": [
                  "kms:Decrypt"
                ],
                "Resource": [
                  `arn:aws:kms:${region}:${accountId}:key/%FIREHOSE_POLICY_TEMPLATE_PLACEHOLDER%`
                ],
                "Condition": {
                  "StringEquals": {
                    "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
                  },
                  "StringLike": {
                    "kms:EncryptionContext:aws:kinesis:arn": `arn:aws:kinesis:${region}:${accountId}:stream/${sentimentResultStreamName}`
                  }
                }
              }
            ]
          }
        }
      ]
    })
    firehoseRole.addDependsOn(glueTable);

    const saveTos3Firehose = new firehose.CfnDeliveryStream(this, firehoseName, {
      deliveryStreamName: firehoseName,
      deliveryStreamType: "KinesisStreamAsSource",
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: `arn:aws:kinesis:${region}:${accountId}:stream/${sentimentResultStreamName}`,
        roleArn: `arn:aws:iam::${accountId}:role/${fireHoseRoleName}`,
      },
      extendedS3DestinationConfiguration: {
        bucketArn: `arn:aws:s3:::${messagesBucketName}`,
        roleArn: `arn:aws:iam::${accountId}:role/${fireHoseRoleName}`,
        prefix: 'sentiments/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/hour=!{timestamp:hh}/',
        errorOutputPrefix: 'errors/',
        dataFormatConversionConfiguration: {
          enabled: true,
          inputFormatConfiguration: {
            deserializer: {
              openXJsonSerDe: {}
            }
          },
          outputFormatConfiguration: {
            serializer: {
              parquetSerDe: {}
            }
          },
          schemaConfiguration: {
            catalogId: accountId,
            databaseName: glueDatabaseName,
            tableName: "sentiments",
            region: region,
            versionId: "LATEST",
            roleArn: `arn:aws:iam::${accountId}:role/${fireHoseRoleName}`
          }
        }
      },
    });
    saveTos3Firehose.addDependsOn(firehoseRole);

    const KDAOutputStream = new kinesis.Stream(this, notificationsOutputStreamName, {
      streamName: notificationsOutputStreamName,
    });

    const invokeLambdaManagedPolicy = new iam.CfnManagedPolicy(this, invokeLambdaManagedPolicyName, {
      managedPolicyName: invokeLambdaManagedPolicyName,
      policyDocument: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Sid": "UseLambdaFunction",
            "Effect": "Allow",
            "Action": [
              "lambda:InvokeFunction",
              "lambda:GetFunctionConfiguration"
            ],
            "Resource": `arn:aws:lambda:${config.region}:${config.accountId}:function:${startStepFunctionNotificationLambdaName}`
          }
        ]
      }
    });

    const notificationAltPolicy = new iam.CfnManagedPolicy(this, notificationAltPolicyName, {
      managedPolicyName: notificationAltPolicyName,
      policyDocument: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Sid": "ReadInputKinesis",
            "Effect": "Allow",
            "Action": [
              "kinesis:DescribeStream",
              "kinesis:GetShardIterator",
              "kinesis:GetRecords"
            ],
            "Resource": [
              `arn:aws:kinesis:${config.region}:${config.accountId}:stream/${sentimentResultStreamName}`
            ]
          },
          {
            "Sid": "WriteOutputKinesis",
            "Effect": "Allow",
            "Action": [
              "kinesis:DescribeStream",
              "kinesis:PutRecord",
              "kinesis:PutRecords"
            ],
            "Resource": [
              `arn:aws:kinesis:${config.region}:${config.accountId}:stream/${notificationsOutputStreamName}`
            ]
          },
          {
            "Sid": "WriteOutputFirehose",
            "Effect": "Allow",
            "Action": [
              "firehose:DescribeDeliveryStream",
              "firehose:PutRecord",
              "firehose:PutRecordBatch"
            ],
            "Resource": [
              "arn:aws:firehose:region:account-id:deliverystream/%FIREHOSE_NAME_PLACEHOLDER%"
            ]
          },
          {
            "Sid": "ReadInputFirehose",
            "Effect": "Allow",
            "Action": [
              "firehose:DescribeDeliveryStream",
              "firehose:Get*"
            ],
            "Resource": [
              "arn:aws:firehose:region:account-id:deliverystream/%FIREHOSE_NAME_PLACEHOLDER%"
            ]
          },
          {
            "Sid": "ReadS3ReferenceData",
            "Effect": "Allow",
            "Action": [
              "s3:GetObject"
            ],
            "Resource": [
              "arn:aws:s3:::kinesis-analytics-placeholder-s3-bucket/kinesis-analytics-placeholder-s3-object"
            ]
          },
          {
            "Sid": "ReadEncryptedInputKinesisStream",
            "Effect": "Allow",
            "Action": [
              "kms:Decrypt"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%SOURCE_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": `arn:aws:kinesis:${config.region}:${config.accountId}:stream/${sentimentResultStreamName}`
              }
            }
          },
          {
            "Sid": "WriteEncryptedOutputKinesisStream1",
            "Effect": "Allow",
            "Action": [
              "kms:GenerateDataKey"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%DESTINATION_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": `arn:aws:kinesis:${config.region}:${config.accountId}:stream/${notificationsOutputStreamName}`
              }
            }
          },
          {
            "Sid": "WriteEncryptedOutputKinesisStream2",
            "Effect": "Allow",
            "Action": [
              "kms:GenerateDataKey"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%DESTINATION_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": "arn:aws:kinesis:region:account-id:stream/%STREAM_NAME_PLACEHOLDER%"
              }
            }
          },
          {
            "Sid": "WriteEncryptedOutputKinesisStream3",
            "Effect": "Allow",
            "Action": [
              "kms:GenerateDataKey"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%DESTINATION_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": "arn:aws:kinesis:region:account-id:stream/%STREAM_NAME_PLACEHOLDER%"
              }
            }
          },
          {
            "Sid": "UseLambdaFunction",
            "Effect": "Allow",
            "Action": [
              "lambda:InvokeFunction",
              "lambda:GetFunctionConfiguration"
            ],
            "Resource": [
              "arn:aws:lambda:region:account-id:function:%FUNCTION_NAME_PLACEHOLDER%:%FUNCTION_VERSION_PLACEHOLDER%"
            ]
          }
        ]
      }
    });

    const notificationPolicy = new iam.CfnManagedPolicy(this, notificationPolicyName, {
      managedPolicyName: notificationPolicyName,
      policyDocument: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Sid": "ReadInputKinesis",
            "Effect": "Allow",
            "Action": [
              "kinesis:DescribeStream",
              "kinesis:GetShardIterator",
              "kinesis:GetRecords"
            ],
            "Resource": [
              `arn:aws:kinesis:${config.region}:${config.accountId}:stream/${sentimentResultStreamName}`
            ]
          },
          {
            "Sid": "WriteOutputKinesis",
            "Effect": "Allow",
            "Action": [
              "kinesis:DescribeStream",
              "kinesis:PutRecord",
              "kinesis:PutRecords"
            ],
            "Resource": [
              "arn:aws:kinesis:region:account-id:stream/%STREAM_NAME_PLACEHOLDER%"
            ]
          },
          {
            "Sid": "WriteOutputFirehose",
            "Effect": "Allow",
            "Action": [
              "firehose:DescribeDeliveryStream",
              "firehose:PutRecord",
              "firehose:PutRecordBatch"
            ],
            "Resource": [
              "arn:aws:firehose:region:account-id:deliverystream/%FIREHOSE_NAME_PLACEHOLDER%"
            ]
          },
          {
            "Sid": "ReadInputFirehose",
            "Effect": "Allow",
            "Action": [
              "firehose:DescribeDeliveryStream",
              "firehose:Get*"
            ],
            "Resource": [
              "arn:aws:firehose:region:account-id:deliverystream/%FIREHOSE_NAME_PLACEHOLDER%"
            ]
          },
          {
            "Sid": "ReadS3ReferenceData",
            "Effect": "Allow",
            "Action": [
              "s3:GetObject"
            ],
            "Resource": [
              "arn:aws:s3:::kinesis-analytics-placeholder-s3-bucket/kinesis-analytics-placeholder-s3-object"
            ]
          },
          {
            "Sid": "ReadEncryptedInputKinesisStream",
            "Effect": "Allow",
            "Action": [
              "kms:Decrypt"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%SOURCE_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": `arn:aws:kinesis:${config.region}:${config.accountId}:stream/${sentimentResultStreamName}`
              }
            }
          },
          {
            "Sid": "WriteEncryptedOutputKinesisStream1",
            "Effect": "Allow",
            "Action": [
              "kms:GenerateDataKey"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%DESTINATION_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": "arn:aws:kinesis:region:account-id:stream/%STREAM_NAME_PLACEHOLDER%"
              }
            }
          },
          {
            "Sid": "WriteEncryptedOutputKinesisStream2",
            "Effect": "Allow",
            "Action": [
              "kms:GenerateDataKey"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%DESTINATION_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": "arn:aws:kinesis:region:account-id:stream/%STREAM_NAME_PLACEHOLDER%"
              }
            }
          },
          {
            "Sid": "WriteEncryptedOutputKinesisStream3",
            "Effect": "Allow",
            "Action": [
              "kms:GenerateDataKey"
            ],
            "Resource": [
              "arn:aws:kms:region:account-id:key/%DESTINATION_STREAM_ENCRYPTION_KEY_PLACEHOLDER%"
            ],
            "Condition": {
              "StringEquals": {
                "kms:ViaService": `kinesis.${config.region}.amazonaws.com`
              },
              "StringLike": {
                "kms:EncryptionContext:aws:kinesis:arn": "arn:aws:kinesis:region:account-id:stream/%STREAM_NAME_PLACEHOLDER%"
              }
            }
          },
          {
            "Sid": "UseLambdaFunction",
            "Effect": "Allow",
            "Action": [
              "lambda:InvokeFunction",
              "lambda:GetFunctionConfiguration"
            ],
            "Resource": [
              "arn:aws:lambda:region:account-id:function:%FUNCTION_NAME_PLACEHOLDER%:%FUNCTION_VERSION_PLACEHOLDER%"
            ]
          }
        ]
      }
    });

    const kinesisRole = new iam.CfnRole(this, kinesisApplicationRoleName, {
      roleName: `${kinesisApplicationRoleName}-${config.region}`,
      assumeRolePolicyDocument: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": {
              "Service": "kinesisanalytics.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
          }
        ]
      },
      managedPolicyArns: [
        `arn:aws:iam::${config.accountId}:policy/${config.resourcesPrefix}-invoke_lambda`,
        `arn:aws:iam::${config.accountId}:policy/kinesis-analytics-${kinesisApplicationRoleName}-${config.region}`,
        `arn:aws:iam::${config.accountId}:policy/kinesis-analytics-${kinesisApplicationRoleName}-${config.region}-alt`],
    });

    kinesisRole.addDependsOn(invokeLambdaManagedPolicy);
    kinesisRole.addDependsOn(notificationAltPolicy);
    kinesisRole.addDependsOn(notificationPolicy);

    const sqlStatement = fs.readFileSync(path.join(__dirname, '../resources', 'notification-system.sql'), 'utf8');

    // KDA application definition
    const sqlApplication = new kda.CfnApplication(this, notificationSystemName, {
      applicationName: notificationSystemName,
      applicationDescription: 'Search users with a negative strike of messages to trigger notifications.',
      inputs: [{
        inputSchema: {
          recordEncoding: 'UTF-8',
          recordFormat: {
            recordFormatType: 'JSON',
            mappingParameters: {
              jsonMappingParameters: {
                recordRowPath: '$'
              }
            }
          },
          recordColumns: [
            { mapping: '$.id', name: 'id', sqlType: 'VARCHAR(64)' },
            { mapping: '$.recognizedBy', name: 'recognizedBy', sqlType: 'VARCHAR(16)' },
            { mapping: '$.lexResult.Payload.intentName', name: 'intentName', sqlType: 'VARCHAR(8)' },
            { mapping: '$.audioUrl', name: 'audioUrl', sqlType: 'VARCHAR(8)' },
            { mapping: '$.inputText', name: 'inputText', sqlType: 'VARCHAR(32)' },
            { mapping: '$.userId', name: 'userId', sqlType: 'VARCHAR(64)' },
            { mapping: '$.dateTime', name: 'dateTime', sqlType: 'BIGINT' }
          ],
        },
        namePrefix: 'SOURCE_SQL_STREAM',
        kinesisStreamsInput: {
          resourceArn: `arn:aws:kinesis:${region}:${accountId}:stream/${sentimentResultStreamName}`,
          roleArn: `arn:aws:iam::${accountId}:role/${kinesisApplicationRoleName}-${config.region}`
        }
      }],
      applicationCode: sqlStatement,
    });

    sqlApplication.addDependsOn(kinesisRole);

    // KDA application output
    const sqlApplicationOutputStream = new kda.CfnApplicationOutput(this, applicationOutputStreamName, {
      applicationName: notificationSystemName,
      output: {
        destinationSchema: {
          recordFormatType: 'JSON'
        },
        name: "AGGREGATE_SENTIMENT_STREAM",
        kinesisStreamsOutput: {
          resourceArn: `arn:aws:kinesis:${region}:${accountId}:stream/${notificationsOutputStreamName}`,
          roleArn: `arn:aws:iam::${accountId}:role/${kinesisApplicationRoleName}-${config.region}`
        }
      }
    });

    sqlApplicationOutputStream.addDependsOn(sqlApplication);

    // Lambda to start Notification Step Function
    const kdaOutputEventSource = new KinesisEventSource(KDAOutputStream, {
      startingPosition: lambda.StartingPosition.LATEST,
    });

    // Lambda retrieveUserData
    const retrieveUserData = new lambda.Function(this, retrieveUserDataLambdaName, {
      functionName: retrieveUserDataLambdaName,
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "handlers/notifications/retrieveUserData.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")),
    });

    retrieveUserData.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["dynamodb:*"],
        resources: ["*"],
      })
    );

    // Lambda sendEmail
    const sendEmail = new lambda.Function(this, sendEmailLambdaName, {
      functionName: sendEmailLambdaName,
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "handlers/notifications/sendEmail.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src"))
    });

    sendEmail.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ses:*"],
        resources: ["*"],
      })
    );

    const publishSentimentNotification = new lambda.Function(this, publishSentimentNotificationLambdaName, {
      functionName: publishSentimentNotificationLambdaName,
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "handlers/notifications/publishSentimentNotification.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")),
    });

    publishSentimentNotification.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["SNS:*"],
        resources: ["*"],
      })
    );

    // Step Function definition
    const retrieveUserDataTask = new sfn.Task(this, retrieveUserDataTaskName, {
      task: new tasks.RunLambdaTask(retrieveUserData),
    });

    const sendEmailTask = new sfn.Task(this, sendEmailTaskName, {
      task: new tasks.InvokeFunction(sendEmail)
    });

    const sendNotificationTask = new sfn.Task(this, sendNotificationTaskName, {
      task: new tasks.InvokeFunction(publishSentimentNotification),
    });

    const parrallProcessing = new sfn.Parallel(this, 'parrallProcessing', {}).branch(sendEmailTask).branch(sendNotificationTask);

    const Exit = new sfn.Pass(this, 'Exit');

    let notificationDefinition = retrieveUserDataTask.next(
      new sfn.Choice(this, "Email was sent ?")
        .when(
          sfn.Condition.stringEquals(
            "$.Payload.userData.notificationDateTime",
            ""
          ),
          parrallProcessing
        )
        .when(
          sfn.Condition.stringGreaterThan(
            "$.Payload.userData.notificationDateTime",
            ""
          ),
          Exit
        )
        .otherwise(parrallProcessing)
    );

    const notifications = new sfn.StateMachine(this, notificationsStepFnName, {
      stateMachineName: notificationsStepFnName,
      definition: notificationDefinition,
    }
    );


    const startStepFunctionNotification = new lambda.Function(this, startStepFunctionNotificationLambdaName, {
      functionName: startStepFunctionNotificationLambdaName,
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "handlers/notifications/startStepFunctionNotification.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")),
      environment: {
        STEP_FUNCTION_ARN: notifications.stateMachineArn,
      },
    });

    startStepFunctionNotification.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:*"],
        resources: ["*"],
      })
    );

    startStepFunctionNotification.addEventSource(kdaOutputEventSource);

    const notificationsSnsTopic = new sns.Topic(this, snsNotificationsTopicName, {
      displayName: snsNotificationsTopicName,
      topicName: snsNotificationsTopicName
    });

    notificationsSnsTopic.addSubscription(new subs.EmailSubscription(emailSubcription));

    const sesTemplate = new ses.CfnTemplate(this, sesNotificationsTemplateName, {
      template: {
        templateName: sesNotificationsTemplateName,
        subjectPart: negativeMessageEmailSubject,
        htmlPart: "<h1>Negative feelings alert!</h1><h2>Hello {{name}},</h2><p>We detect that in the past 1 hour you sent {{negativeCount}} or more negative messages than positive messages.</p><h3>Messages:</h3><p>{{inputText}}</p>"
      }
    });

    //Dump user dynamo table to S3
    const syncDynamoS3 = new lambda.Function(this, syncDynamoS3Name, {
      functionName: syncDynamoS3Name,
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "handlers/users/sync-dynamo-s3.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambdas/src")),
    });

    const dynamoUserEventSource = new DynamoEventSource(userTable, {
      startingPosition: lambda.StartingPosition.LATEST,
      maxBatchingWindow: Duration.seconds(300)
    });

    syncDynamoS3.addEventSource(dynamoUserEventSource);

    syncDynamoS3.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [`arn:aws:lambda:${config.region}:${config.accountId}:function:${syncDynamoS3Name}*`],
      }
    )
    );
    syncDynamoS3.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        resources: [`arn:aws:logs:${config.region}:${config.accountId}:*`],
      }
    )
    );
    syncDynamoS3.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        actions: [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ],
        resources: [`arn:aws:dynamodb:${config.region}:${config.accountId}:table/${dynamocnf.aws.dynamoDB.userTable.name}/stream/*`],
      }
    )
    );
    syncDynamoS3.addToRolePolicy(new iam.PolicyStatement(
      {
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:*"
        ],
        resources: ["*"],
      }
    )
    );

  }
}
