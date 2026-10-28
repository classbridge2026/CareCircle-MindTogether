-- Install the seven anxiety questions from the supplied GAD-7 form.
-- Availability stays inactive until clinical approval, the safety protocol, and local support contacts are recorded.

UPDATE "ScreeningTool"
SET
  "name" = 'Anxiety screening (GAD-7)',
  "purpose" = 'A seven-question anxiety screen for the last two weeks. The score is not a diagnosis.',
  "intendedPopulation" = 'Adults completing their own screen.',
  "instructions" = 'Answer every question for the last two weeks. Choose how often each problem bothered you.',
  "sourceReference" = 'GAD-7, developed by Drs. Robert L. Spitzer, Janet B.W. Williams, Kurt Kroenke and colleagues, with an educational grant from Pfizer Inc. No permission required to reproduce, translate, display or distribute.',
  "licenseStatus" = 'CLEARED_FOR_CLINICAL_USE',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'GAD7';

UPDATE "ScreeningToolVersion" AS version
SET
  "scoringAlgorithmVersion" = 'gad-7-sum-severity-1',
  "items" = $gad7_items$[
    {"index":0,"prompt":"Over the last 2 weeks, how often have you been bothered by feeling nervous, anxious, or on edge?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":1,"prompt":"Over the last 2 weeks, how often have you been bothered by not being able to stop or control worrying?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":2,"prompt":"Over the last 2 weeks, how often have you been bothered by worrying too much about different things?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":3,"prompt":"Over the last 2 weeks, how often have you been bothered by trouble relaxing?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":4,"prompt":"Over the last 2 weeks, how often have you been bothered by being so restless that it is hard to sit still?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":5,"prompt":"Over the last 2 weeks, how often have you been bothered by becoming easily annoyed or irritable?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]},
    {"index":6,"prompt":"Over the last 2 weeks, how often have you been bothered by feeling afraid as if something awful might happen?","choices":[{"value":0,"label":"Not at all"},{"value":1,"label":"Several days"},{"value":2,"label":"More than half the days"},{"value":3,"label":"Nearly every day"}]}
  ]$gad7_items$::jsonb,
  "scoringSpec" = $gad7_score${
    "kind":"SUM",
    "items":[
      {"index":0,"min":0,"max":3},
      {"index":1,"min":0,"max":3},
      {"index":2,"min":0,"max":3},
      {"index":3,"min":0,"max":3},
      {"index":4,"min":0,"max":3},
      {"index":5,"min":0,"max":3},
      {"index":6,"min":0,"max":3}
    ],
    "bands":[
      {"min":0,"max":4,"label":"Minimal"},
      {"min":5,"max":9,"label":"Mild"},
      {"min":10,"max":14,"label":"Moderate"},
      {"min":15,"max":21,"label":"Severe"}
    ],
    "safety":null
  }$gad7_score$::jsonb
FROM "ScreeningTool" AS tool
WHERE version."toolId" = tool."id"
  AND tool."code" = 'GAD7'
  AND version."version" = '1.0'
  AND jsonb_array_length(version."items") = 0;
