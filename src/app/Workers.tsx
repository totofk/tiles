import { certificateCost, certificateUnlock, workerHireCost, workerPoolCap } from '../core/balance'
import { ITEMS } from '../core/data/items'
import { TOOLS, type ToolJob } from '../core/data/tools'
import { WORKER_JOBS, type WorkerJob } from '../core/data/workers'
import type { GameState } from '../core/state'
import { assignWorker, buyCertificate, freeWorkers,hireUnlocked, hireWorker, workerUnpaid } from '../core/workers'
import { Info } from './Info'
import { HAND_PICKED } from './marketText'
import { priceText } from './Mine'
import { TIPS, WORKER_TIPS } from './tips'
import { MINE_EMOJI, PLANT_EMOJI, type Act } from './useGame'

/** the job's icon: its row label and the pop on a tile a farm worker acts on */
export const WORKER_JOB_EMOJI: Record<WorkerJob, string> = {
  plant: PLANT_EMOJI,
  water: '💧',
  harvest: '🌾',
  ore: ITEMS.copperOre.emoji,
  fuel: ITEMS.coal.emoji,
  mine: MINE_EMOJI,
}
export const WORKER_JOB_LABEL: Record<WorkerJob, string> = {
  plant: `${WORKER_JOB_EMOJI.plant} Plant`,
  water: `${WORKER_JOB_EMOJI.water} Water`,
  harvest: `${WORKER_JOB_EMOJI.harvest} Harvest`,
  ore: `${WORKER_JOB_EMOJI.ore} Ore`,
  fuel: `${WORKER_JOB_EMOJI.fuel} Fuel`,
  mine: `${WORKER_JOB_EMOJI.mine} Mine`,
}

/** the row's ⓘ text; the harvester's also says workers sell at ×1 (hand-picked is the player's) */
const jobTip = (job: WorkerJob) => (job === 'harvest' ? `${WORKER_TIPS.harvest} Workers sell at ×1; what you harvest yourself sells at ${HAND_PICKED}.` : WORKER_TIPS[job])

/** one job: [−] n [+] once its certificate is owned, else the certificate price (and its gate progress while locked) */
function JobRow({ state, act, job }: { state: GameState; act: Act; job: WorkerJob }) {
  const { run, meta } = state
  if (!run.workers.certificates.includes(job)) {
    const { counter, at, vein = 0, tool = 0 } = certificateUnlock(job)
    const toolLevel = job in TOOLS ? run.tools[job as ToolJob] : 0
    // items the price needs beyond what storage holds can never be gathered (the harvest certificate's 25 at the start's 20)
    const { cash, ...items } = certificateCost(job, meta)
    void cash
    const itemCount = Object.values(items).reduce((n, k) => n + (k ?? 0), 0)
    // only the gates still missing, one line each (both on one line would push the ⓘ off the 284 px row at 1024)
    const missing = [
      run.counters[counter] < at && `${counter} ${run.counters[counter]}/${at}`,
      run.vein.level < vein && `vein Lv${vein}`,
      toolLevel < tool && `needs ${WORKER_JOB_EMOJI[job]} ${TOOLS[job as ToolJob].names[tool - 1]} (tool Lv${tool})`,
      itemCount > run.bagCapacity && `needs 📦 ${itemCount} storage`,
    ]
    return (
      <div className="worker-row">
        <span>
          {WORKER_JOB_LABEL[job]}
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
  return (
    <div className="worker-row">
      <span>{WORKER_JOB_LABEL[job]}</span>
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

/** 👷 card: in the desktop 🌾 Farm tab, below the grid elsewhere; closed by default so the farm column stays short */
export function Workers({ state, act }: { state: GameState; act: Act }) {
  const { run, meta } = state
  const { pool } = run.workers
  return (
    <details className="workers">
      <summary>
        👷 Workers · free {freeWorkers(run)} / {pool}
        {WORKER_JOBS.some((job) => workerUnpaid(state, job)) && <span className="unpaid">unpaid</span>}
      </summary>
      {WORKER_JOBS.map((job) => (
        <JobRow key={job} state={state} act={act} job={job} />
      ))}
      {hireUnlocked(run) && (
        <div className="worker-row">
          <button disabled={!hireWorker(state).ok} onClick={() => act(hireWorker)}>
            👷 Hire worker <small>{pool >= workerPoolCap() ? 'pool full' : `💰${workerHireCost(pool, meta)}`}</small>
          </button>
          <Info text={TIPS.hire} />
        </div>
      )}
    </details>
  )
}
