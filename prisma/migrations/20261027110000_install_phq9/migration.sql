-- Install the nine depression questions from the supplied Patient Health Questionnaire.
-- The paper's other sections use skip rules this scorer cannot total, so they are not stored.
-- Availability stays inactive until clinical approval, the safety protocol, and local support contacts are recorded.

UPDATE "ScreeningTool"
SET
  "name" = 'Depression screening (PHQ-9)',
  "purpose" = 'A nine-question depression screen for the last two weeks. The score is not a diagnosis.',
  "intendedPopulation" = 'Adults completing their own screen.',
  "instructions" = 'Answer every question for the last two weeks. Choose how often each problem bothered you.',
  "sourceReference" = 'Patient Health Questionnaire depression items, developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.',
  "licenseStatus" = 'CLEARED_FOR_CLINICAL_USE',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'PHQ9';

UPDATE "ScreeningToolVersion" AS version
SET
  "scoringAlgorithmVersion" = 'phq-9-sum-severity-1',
  "items" = $phq9_items$[
    {"index":0,"prompt":"Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":1,"prompt":"Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":2,"prompt":"Over the last 2 weeks, how often have you been bothered by trouble falling or staying asleep, or sleeping too much?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":3,"prompt":"Over the last 2 weeks, how often have you been bothered by feeling tired or having little energy?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":4,"prompt":"Over the last 2 weeks, how often have you been bothered by poor appetite or overeating?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":5,"prompt":"Over the last 2 weeks, how often have you been bothered by feeling bad about yourself, or that you are a failure or have let yourself or your family down?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":6,"prompt":"Over the last 2 weeks, how often have you been bothered by trouble concentrating on things, such as reading the newspaper or watching television?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":7,"prompt":"Over the last 2 weeks, how often have you been bothered by moving or speaking so slowly that other people could have noticed, or the opposite — being so fidgety or restless that you have been moving around a lot more than usual?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":8,"prompt":"Over the last 2 weeks, how often have you been bothered by thoughts that you would be better off dead or of hurting yourself in some way?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]}
  ]$phq9_items$::jsonb,
  "scoringSpec" = $phq9_score${
    "kind":"SUM",
    "items":[
      {"index":0,"min":0,"max":3},
      {"index":1,"min":0,"max":3},
      {"index":2,"min":0,"max":3},
      {"index":3,"min":0,"max":3},
      {"index":4,"min":0,"max":3},
      {"index":5,"min":0,"max":3},
      {"index":6,"min":0,"max":3},
      {"index":7,"min":0,"max":3},
      {"index":8,"min":0,"max":3}
    ],
    "bands":[
      {"min":0,"max":4,"label":"None-minimal"},
      {"min":5,"max":9,"label":"Mild"},
      {"min":10,"max":14,"label":"Moderate"},
      {"min":15,"max":19,"label":"Moderately severe"},
      {"min":20,"max":27,"label":"Severe"}
    ],
    "safety":{"itemIndex":8,"whenAtLeast":1}
  }$phq9_score$::jsonb
FROM "ScreeningTool" AS tool
WHERE version."toolId" = tool."id"
  AND tool."code" = 'PHQ9'
  AND version."version" = '1.0'
  AND jsonb_array_length(version."items") = 0;
