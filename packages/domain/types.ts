export type Family = 'compute' | 'data' | 'async' | 'resilience' | 'security' | 'operation' | 'communication';
export type NodeKind = 'client' | 'api' | 'database' | 'payment' | 'cache' | 'queue' | 'worker' | 'balancer' | 'cdn' | 'storage';
export type Config = Record<string, number>;
export interface Field { label: string; min: number; max: number; step: number; default: number; unit?: string }
export interface Card { id: string; name: string; family: Family; kind: 'node' | 'upgrade' | 'policy' | 'protocol' | 'action'; nodeKind?: NodeKind; targets?: string[]; ec: number; infra: number; acquisition: number; mechanism: string; tradeoff: string; fields: Record<string, Field> }
export interface Node { id: string; kind: NodeKind; name: string; x: number; z: number; config: Config; upgrades: string[] }
export interface Edge { id: string; from: string; to: string; protocol: string; read: number; write: number; config: Config; policies: string[] }
export interface Graph { nodes: Node[]; edges: Edge[] }
export interface CardInstance { uid: string; cardId: string }
export interface Scenario { id: string; title: string; subtitle: string; description: string; heat: number; axis: string; duration: number; mutation: Partial<World>; signals: string[] }
export interface World { reads: number; writes: number; updateRate: number; hot: number; paymentMs: number; paymentError: number; attack: number; attackKind?: number; regionMs: number; failure: number; budget: number; slo: number; completionSlo: number }
export interface WorldState { baseline: World; active: { card: Scenario; expires: number }[]; world: World }
export interface Runtime { queueBacklog: Record<string, number>; warm: Record<string, number>; history: Telemetry[] }
export interface NodeMetric { id: string; demand: number; capacity: number; utilization: number; latency: number; cost: number }
export type IncidentKind = 'retry_storm' | 'cache_stampede' | 'queue_backlog' | 'connection_exhaustion' | 'stale_data' | 'inventory_race' | 'cascading_failure';
export type IncidentSeverity = 'warning' | 'critical';
export type IncidentPhase = 'triggered' | 'ongoing' | 'recovered';
export interface Incident { id: string; kind: IncidentKind; type: string; severity: IncidentSeverity; locus: { type: 'node' | 'edge'; id: string }; nodeId: string; detail: string; phase: IncidentPhase; firstSeenRound: number }
export interface Telemetry { p95: number; throughput: number; errorRate: number; availability: number; consistency: number; security: number; completion: number; cost: number; complexity: number; blocked: number; falsePositive: number; nodes: NodeMetric[]; incidents: Incident[]; traces: string[]; backlog: number; observed: boolean; diagnostic: boolean }
export interface Player { id: number; name: string; specialty: string; deck: CardInstance[]; hand: CardInstance[]; backlog: CardInstance[]; discard: CardInstance[]; graph: Graph; ec: number; actions: number; budget: number; runtime: Runtime; telemetry: Telemetry; locked: boolean; mulliganDone: boolean; pending: Command[]; research?: CardInstance[] }
export type Command = { type: 'play'; uid: string; target: string; config: Config; x?: number; z?: number } | { type: 'buy'; uid: string } | { type: 'reserve' | 'retrieve' | 'researchChoice'; uid: string } | { type: 'configure'; target: string; config: Config } | { type: 'connect'; from: string; to: string; read: number; write: number; protocol: string } | { type: 'remove'; target: string } | { type: 'move'; target: string; x: number; z: number } | { type: 'pass' };
export interface LogEntry { type: 'mulligan' | 'ready' | 'stage' | 'undo' | 'lock' | 'advance'; player: number; command?: Command; uids?: string[] }
export interface Category { id: string; name: string; description: string; unit: string; lower: boolean; values: [number, number]; winner: number | null; details: [string[], string[]]; telemetry: [Telemetry, Telemetry] }
export interface Showdown { categories: Category[]; wins: [number, number]; winner: number | null; tieBreak: [number, number]; graphs: [Graph, Graph] }
export interface Match { id: string; seed: string; version: number; phase: 'setup' | 'planning' | 'adjustment' | 'telemetry' | 'showdown'; round: number; players: [Player, Player]; market: CardInstance[]; marketDeck: CardInstance[]; scenarios: Scenario[]; revealed: Scenario[]; worldState: WorldState; log: LogEntry[]; showdown?: Showdown; notices: [string[], string[]]; contentVersion: string; engineVersion: string }
export interface Target { id: string; label: string; type: 'node' | 'edge' | 'slot' | 'self' }
export interface ChallengeObjective { id: 'showdown' | 'budget' | 'stability'; label: string; description: string }
export interface DailyChallengeDefinition { id: string; date: string; title: string; publicBrief: string; specialty: string; objectives: ChallengeObjective[]; expiresAt: number; contentVersion: string; engineVersion: string }
export interface ChallengeObjectiveResult extends ChallengeObjective { met: boolean; value: string }
export interface ChallengeResult { completed: true; score: number; medal: 'bronze' | 'silver' | 'gold'; categoriesWon: number; objectives: ChallengeObjectiveResult[] }
export interface PlayerView { previousWorld?: World; measurements?: {round:number;telemetry:Partial<Telemetry>}[]; clock?: {key:string;deadline:number;duration:number;serverNow:number}; challenge?: DailyChallengeDefinition; challengeResult?: ChallengeResult; id: string; version: number; phase: Match['phase']; round: number; player: Omit<Player, 'deck' | 'runtime' | 'telemetry'> & { deckCount: number; telemetry: Partial<Telemetry> }; opponent: { name: string; locked: boolean; controller?: 'ai' }; market: CardInstance[]; marketRemaining: number; scenarioRemaining: number; revealed: Omit<Scenario, 'heat' | 'axis' | 'mutation'>[]; world: World; notices: string[]; showdown?: Showdown }
