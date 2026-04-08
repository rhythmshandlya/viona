// packages/sandbox/src/job-state.ts

export interface ActiveTask {
  id: string;
  agent: string;
  action: string;
  target?: string;
  startedAt: number;
  status: 'active' | 'completed';
}

export interface JobState {
  isBusy: boolean;
  startedAt: number;
  turnId: string | null;
  activeTasks: ActiveTask[];
  plan: { title: string; tasks: unknown[] } | null;
  widget: unknown | null;
  textBuffer: string;
  result: { sessionId?: string; cost?: number } | null;
  error: string | null;
}

let currentJob: JobState | null = null;

// Removal timers for completed tasks (fade-out delay)
const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Listeners notified on every state change
const listeners: Array<(type: string, data: unknown) => void> = [];

let taskIdCounter = 0;
function nextTaskId(): string {
  return `task-${++taskIdCounter}`;
}

export function getJobState(): JobState | null {
  return currentJob;
}

export function isJobBusy(): boolean {
  return !!currentJob?.isBusy;
}

export function startJob(turnId?: string): void {
  // Clear any lingering removal timers
  for (const timer of removalTimers.values()) clearTimeout(timer);
  removalTimers.clear();
  taskIdCounter = 0;

  currentJob = {
    isBusy: true,
    startedAt: Date.now(),
    turnId: turnId ?? null,
    activeTasks: [],
    plan: null,
    widget: null,
    textBuffer: '',
    result: null,
    error: null,
  };
}

export function addTask(agent: string, action: string, target?: string): string {
  if (!currentJob) return '';
  const id = nextTaskId();
  const task: ActiveTask = { id, agent, action, target, startedAt: Date.now(), status: 'active' };
  currentJob.activeTasks.push(task);
  notify('task_started', task);
  return id;
}

export function updateTask(id: string, action: string): void {
  if (!currentJob) return;
  const task = currentJob.activeTasks.find(t => t.id === id);
  if (task && task.status === 'active') {
    task.action = action;
    notify('task_updated', { id, action });
  }
}

export function completeTask(id: string): void {
  if (!currentJob) return;
  const task = currentJob.activeTasks.find(t => t.id === id);
  if (task) {
    task.status = 'completed';
    notify('task_completed', { id });
    // Remove after 3s delay (allows frontend fade-out)
    const timer = setTimeout(() => {
      if (currentJob) {
        currentJob.activeTasks = currentJob.activeTasks.filter(t => t.id !== id);
      }
      removalTimers.delete(id);
    }, 3000);
    removalTimers.set(id, timer);
  }
}

export function updatePlan(plan: { title: string; tasks: unknown[] }): void {
  if (!currentJob) return;
  currentJob.plan = plan;
  notify('plan', plan);
}

export function updateWidget(widget: unknown): void {
  if (!currentJob) return;
  currentJob.widget = widget;
  notify('widget', widget);
}

export function appendText(text: string): void {
  if (!currentJob) return;
  currentJob.textBuffer += text;
  notify('text', { text });
}

export function finishJob(result: { sessionId?: string; cost?: number }): void {
  if (!currentJob) return;
  currentJob.isBusy = false;
  currentJob.activeTasks = [];
  currentJob.result = result;
  for (const timer of removalTimers.values()) clearTimeout(timer);
  removalTimers.clear();
  notify('done', result);
}

export function failJob(error: string): void {
  if (!currentJob) return;
  currentJob.isBusy = false;
  currentJob.activeTasks = [];
  currentJob.error = error;
  for (const timer of removalTimers.values()) clearTimeout(timer);
  removalTimers.clear();
  notify('error', { message: error });
}

export function onStateChange(fn: (type: string, data: unknown) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(type: string, data: unknown): void {
  for (const fn of listeners) {
    try { fn(type, data); } catch { /* listener errors don't break state */ }
  }
}
