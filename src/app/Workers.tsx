import { certificateCost, certificateUnlock, workerHireCost, workerPoolCap } from '../core/balance'
import { TOOLS, type ToolJob } from '../core/data/tools'
import { HIDDEN_JOBS, WORKER_JOBS, type WorkerJob } from '../core/data/workers'
import type { CounterId, GameState } from '../core/state'
import { assignWorker, buyCertificate, freeWorkers, hireUnlocked, hireWorker, workerUnpaid, type WorkTouch } from '../core/workers'
import { isIrrigated } from '../core/workshop'
import { managerPlanText } from './estateText'
import { price } from './fmt'
import { Info } from './Info'
import { HAND_PICKED } from './marketText'
import { priceText } from './Mine'
import { TIPS, WORKER_TIPS } from './tips'
import { WORKER_JOB_EMOJI, WORKER_JOB_LABEL, type Act } from './useGame'

/** a locked row's gate counter as words where its id would read raw (other counters keep their id) */
const GATE_LABEL: Partial<Record<CounterId, string>> = { contractsByHand: 'contracts delivered' }

/** the row's ⓘ text; the harvester's also says workers sell at ×1 (hand-picked is the player's) */
const jobTip = (job: WorkerJob) => (job === 'harvest' ? `${WORKER_TIPS.harvest} Workers sell at ×1; what you harvest yourself sells at ${HAND_PICKED}.` : WORKER_TIPS[job])

/** one job: [−] n [+] once its certificate is owned, else the certificate price (and its gate progress while locked);
 * `active` = a worker on this job acted in the last work round (the pulsing dot, task 132) */
function JobRow({ state, act, job, active = false }: { state: GameState; act: Act; job: WorkerJob; active?: boolean }) {
  const { run, meta } = state
  const dot = <span className={active ? 'job-dot job-dot-on' : 'job-dot'} aria-hidden="true" />
  if (!run.workers.certificates.includes(job)) {
    const { counter, at, vein = 0, tool = 0 } = certificateUnlock(job)
    const toolLevel = job in TOOLS ? run.tools[job as ToolJob] : 0
    // items the price needs beyond what storage holds can never be gathered (the harvest certificate's 25 at the start's 20)
    const { cash, stars, ...items } = certificateCost(job, meta)
    void [cash, stars]
    const itemCount = Object.values(items).reduce((n, k) => n + (k ?? 0), 0)
    // only the gates still missing, one line each (both on one line would push the ⓘ off the 284 px row at 1024)
    const missing = [
      run.counters[counter] < at && `${GATE_LABEL[counter] ?? counter} ${run.counters[counter]}/${at}`,
      run.vein.level < vein && `vein Lv${vein}`,
      toolLevel < tool && `needs ${WORKER_JOB_EMOJI[job]} ${TOOLS[job as ToolJob].names[tool - 1]} (tool Lv${tool})`,
      itemCount > run.bagCapacity && `needs 📦 ${itemCount} storage`,
    ]
    return (
      <div className="worker-row">
        <span>
          {dot} {WORKER_JOB_LABEL[job]}
          {missing.map((gate) => gate && <small key={gate}>{gate}</small>)}
        </span>
        <button disabled={!buyCertificate(state, job).ok} onClick={() => act((s) => buyCertificate(s, job))}>
          Certificate <small>{priceText(certificateCost(job, meta))}</small>
        </button>
        <Info text={jobTip(job)} />
      </div>
    )
  }
  const name = WORKER_JOB_LABEL[job].split(' ')[1]
  // batch 26: with every owned tile under a sprinkler there is nothing left to water — the row says so
  const nothingToWater = job === 'water' && run.tiles.length > 0 && run.tiles.every((_, i) => isIrrigated(run, i))
  return (
    <div className="worker-row">
      <span>
        {dot} {WORKER_JOB_LABEL[job]}
        {nothingToWater && <small>nothing to water — reassign</small>}
        {job === 'manager' && run.workers.assigned.manager > 0 && run.fields.unlocked && <small>{managerPlanText(state)}</small>}
      </span>
      <button aria-label={`One less on ${name}`} disabled={!assignWorker(state, job, -1).ok} onClick={() => act((s) => assignWorker(s, job, -1))}>
        −
      </button>
      <span className="worker-n">{run.workers.assigned[job]}</span>
      <button aria-label={`One more on ${name}`} disabled={!assignWorker(state, job, 1).ok} onClick={() => act((s) => assignWorker(s, job, 1))}>
        +
      </button>
      {workerUnpaid(state, job) && <span className="unpaid">unpaid</span>}
      <Info text={jobTip(job)} />
    </div>
  )
}

/** 👷 card: in the desktop 🌾 Farm tab, below the grid elsewhere; closed by default so the farm column stays short.
 * `worked` = the jobs that acted in the last work round (dots, and "N working" in the summary, task 132) */
export function Workers({ state, act, worked = [] }: { state: GameState; act: Act; worked?: WorkTouch[] }) {
  const { run, meta } = state
  const { pool } = run.workers
  return (
    <details className="workers">
      <summary>
        👷 Workers · free {freeWorkers(run)} / {pool}
        {worked.length > 0 && ` · ${worked.length} working`}
        {WORKER_JOBS.some((job) => workerUnpaid(state, job)) && <span className="unpaid">unpaid</span>}
      </summary>
      {/* batch 24: the job rows are one group, hiring another over a divider */}
      <div className="group">
        {/* batch 34: the Stoker's certificate is bought in ⭐ Favours, so its row shows only once owned */}
        {WORKER_JOBS.filter((job) => !HIDDEN_JOBS.includes(job) && (job !== 'stoker' || run.workers.certificates.includes(job))).map((job) => (
          <JobRow key={job} state={state} act={act} job={job} active={worked.some((w) => w.job === job)} />
        ))}
      </div>
      {hireUnlocked(run) && (
        <div className="group">
          <div className="worker-row">
            <button disabled={!hireWorker(state).ok} onClick={() => act(hireWorker)}>
              👷 Hire worker <small>{pool >= workerPoolCap() ? 'pool full' : `💰${price(workerHireCost(pool, meta))}`}</small>
            </button>
            <Info text={TIPS.hire} />
          </div>
        </div>
      )}
    </details>
  )
}
