CREATE OR REPLACE STREAM "NUMERIC_SENTIMENT_STREAM"("userId" VARCHAR(64), "numericSentiment" NUMERIC);

CREATE OR REPLACE PUMP "numeric_sentiment_pump" AS
   INSERT INTO "NUMERIC_SENTIMENT_STREAM"
SELECT "userId",  CASE
                                 WHEN "intentName" = 'POSITIVE' THEN 1
                                 WHEN "intentName" = 'NEGATIVE' THEN -1
                                 ELSE 0
    END AS "numericSentiment"
FROM "SOURCE_SQL_STREAM_001";


CREATE OR REPLACE STREAM "AGGREGATE_SENTIMENT_STREAM" ("userId" VARCHAR(64), "numericSentiment" NUMERIC);

CREATE OR REPLACE PUMP "aggregate_sentiment_pump" AS INSERT INTO AGGREGATE_SENTIMENT_STREAM
SELECT STREAM "userId", "aggregateSentiment"
FROM (
         SELECT STREAM "userId", SUM ("numericSentiment") OVER W1 as "aggregateSentiment"
         FROM "NUMERIC_SENTIMENT_STREAM"
                  WINDOW W1 AS (PARTITION BY "userId" RANGE INTERVAL '60' MINUTE PRECEDING)
     ) 
WHERE "aggregateSentiment" <= -3
