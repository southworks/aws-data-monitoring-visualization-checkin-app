# Data generator

This script allows us to generate entries with random data.

## Important

> Do not forget to follow the steps on [Pre Execution](#pre-execution) before running the script and [Post Execution](#post-execution) after running it.
> 
> 

## Configuration

In [the config file](./config.json) we can set the number of daily entries per user to generate, the number of days 
before today to set the records date, the name of the stream to push the entries to, the number of users with an
administrator role, and the number of regular users assigned to each administrator we should generate.

```json
{
  "dailyRecordsPerUser": 2,
  "daysToGenerate": 21,
  "sentimentResultStreamName": "-SentimentResults",
  "totalAdmins": 1,
  "usersPerAdmin": 10
}

```

## Pre Execution

Disable the KDA application currently named `-notification-system` to avoid extra charges and the generation of unneeded notifications.

## Usage

> Considering you are in the project's root folder, navigate to the script's directory.
> 
> ```bash
> cd medium-article/part-2/code/data-generator
>```

### Installing dependencies

> Using your favourite CLI in the script's root folder execute the following:
> 
> ```bash
> npm install
> ```

### Execution

> Using your favourite CLI in the script's root folder execute the following:
>
> ```bash
> node .
> ```
> 

## Post execution

Re-enable the KDA application currently named `-notification-system` to restore the negative streaks notifications.
