export const IPC = {
  // Jobs
  JOBS_LIST:    'jobs:list',
  JOBS_CREATE:  'jobs:create',
  JOBS_UPDATE:  'jobs:update',
  JOBS_DELETE:  'jobs:delete',
  JOBS_RUN_NOW: 'jobs:runNow',
  JOBS_KILL:    'jobs:kill',

  // Runs
  RUNS_LIST:        'runs:list',
  RUNS_LIST_BY_JOB: 'runs:listByJob',
  RUNS_STATS:       'runs:stats',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Push events (main → renderer)
  JOB_STARTED:  'event:jobStarted',
  JOB_FINISHED: 'event:jobFinished',
} as const
