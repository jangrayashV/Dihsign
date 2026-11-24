import type { LucideIcon } from 'lucide-react';
import { technologyComponentRegistry } from './technologyRegistry';
import {
  Activity, BadgeCheck, Cable, CalendarClock, ChartNoAxesCombined, Cloud, Cog, Component, Container,
  Database, Disc3, Folder, Gauge, Globe2, HardDriveUpload, KeyRound, Laptop, Layers3, ListOrdered,
  MailWarning, MonitorCheck, Network, Radio, RadioTower, Route, Rows3, ScanLine, ScrollText, Search,
  Server, Shield, Shuffle, Sigma, Smartphone, Split, TableProperties, Timer, UserRound, Waypoints,
} from 'lucide-react';

export type ComponentCategory =
  | 'Clients' | 'Compute' | 'Networking' | 'Databases' | 'Caching'
  | 'Messaging' | 'Storage' | 'Observability' | 'Security' | 'Other';

export type TechnologyCategory =
  | 'Databases' | 'Caching & Messaging' | 'Networking & Delivery'
  | 'Containers & Infrastructure' | 'CI/CD & Development'
  | 'Observability' | 'Cloud & Storage' | 'AI & Data Engineering';

export type ComponentProperties = Record<string, string | number | boolean>;

export type ComponentDefinition = {
  id: string;
  name: string;
  category: ComponentCategory | TechnologyCategory;
  icon?: LucideIcon;
  iconAsset?: string;
  iconTreatment?: 'light-surface';
  library?: 'generic' | 'technology';
  aliases: readonly string[];
  keywords: readonly string[];
  defaultProperties: ComponentProperties;
};

const genericComponentRegistry = {
  browser: {
    id: 'browser', name: 'Browser', category: 'Clients', icon: Globe2,
    aliases: ['web client', 'web browser'], keywords: ['client', 'frontend', 'http', 'https'],
    defaultProperties: { protocol: 'HTTPS' },
  },
  mobile: {
    id: 'mobile', name: 'Mobile', category: 'Clients', icon: Smartphone,
    aliases: ['mobile app', 'phone'], keywords: ['client', 'ios', 'android', 'frontend'],
    defaultProperties: { platform: 'Mobile' },
  },
  desktop: {
    id: 'desktop', name: 'Desktop', category: 'Clients', icon: Laptop,
    aliases: ['desktop app', 'native client'], keywords: ['client', 'native', 'frontend'],
    defaultProperties: { platform: 'Desktop' },
  },
  user: {
    id: 'user', name: 'User', category: 'Clients', icon: UserRound,
    aliases: ['actor', 'person'], keywords: ['client', 'consumer', 'customer'],
    defaultProperties: { type: 'End user' },
  },
  'iot-device': {
    id: 'iot-device', name: 'IoT', category: 'Clients', icon: RadioTower,
    aliases: ['iot device', 'smart device'], keywords: ['client', 'sensor', 'edge', 'embedded'],
    defaultProperties: { protocol: 'MQTT' },
  },

  'application-server': {
    id: 'application-server', name: 'Application Server', category: 'Compute', icon: Server,
    aliases: ['app server', 'backend server'], keywords: ['compute', 'backend', 'service', 'api'],
    defaultProperties: { instances: 1 },
  },
  worker: {
    id: 'worker', name: 'Worker', category: 'Compute', icon: Cog,
    aliases: ['background worker', 'job worker'], keywords: ['compute', 'async', 'consumer', 'processor'],
    defaultProperties: { concurrency: 1 },
  },
  microservice: {
    id: 'microservice', name: 'Microservice', category: 'Compute', icon: Component,
    aliases: ['service', 'backend service'], keywords: ['compute', 'distributed', 'api'],
    defaultProperties: { instances: 1 },
  },
  'serverless-function': {
    id: 'serverless-function', name: 'Serverless Function', category: 'Compute', icon: Sigma,
    aliases: ['function', 'faas'], keywords: ['compute', 'event driven', 'stateless', 'on demand'],
    defaultProperties: { runtime: 'Managed' },
  },
  container: {
    id: 'container', name: 'Container', category: 'Compute', icon: Container,
    aliases: ['containerized service'], keywords: ['compute', 'runtime', 'image', 'orchestration'],
    defaultProperties: { replicas: 1 },
  },

  'api-gateway': {
    id: 'api-gateway', name: 'API Gateway', category: 'Networking', icon: Route,
    aliases: ['gateway', 'api edge'], keywords: ['network', 'routing', 'api', 'ingress'],
    defaultProperties: { protocol: 'HTTPS' },
  },
  'load-balancer': {
    id: 'load-balancer', name: 'Load Balancer', category: 'Networking', icon: Network,
    aliases: ['lb', 'traffic distributor'], keywords: ['network', 'routing', 'availability', 'traffic'],
    defaultProperties: { algorithm: 'Round robin' },
  },
  'reverse-proxy': {
    id: 'reverse-proxy', name: 'Reverse Proxy', category: 'Networking', icon: Shuffle,
    aliases: ['proxy', 'edge proxy'], keywords: ['network', 'routing', 'upstream', 'ingress'],
    defaultProperties: { protocol: 'HTTPS' },
  },
  dns: {
    id: 'dns', name: 'DNS', category: 'Networking', icon: Globe2,
    aliases: ['domain name system', 'name server'], keywords: ['network', 'domain', 'resolution', 'routing'],
    defaultProperties: { recordType: 'A' },
  },
  cdn: {
    id: 'cdn', name: 'CDN', category: 'Networking', icon: Cloud,
    aliases: ['content delivery network', 'edge cache'], keywords: ['network', 'edge', 'static', 'distribution'],
    defaultProperties: { caching: true },
  },
  firewall: {
    id: 'firewall', name: 'Firewall', category: 'Networking', icon: Shield,
    aliases: ['network firewall', 'waf'], keywords: ['network', 'security', 'filter', 'traffic'],
    defaultProperties: { policy: 'Allow list' },
  },

  'sql-database': {
    id: 'sql-database', name: 'SQL Database', category: 'Databases', icon: TableProperties,
    aliases: ['relational database', 'rdbms'], keywords: ['database', 'sql', 'relational', 'transactional'],
    defaultProperties: { model: 'Relational' },
  },
  'nosql-database': {
    id: 'nosql-database', name: 'NoSQL Database', category: 'Databases', icon: Rows3,
    aliases: ['non relational database', 'document database'], keywords: ['database', 'nosql', 'key value', 'document'],
    defaultProperties: { model: 'NoSQL' },
  },
  database: {
    id: 'database', name: 'Database', category: 'Databases', icon: Database,
    aliases: ['data store', 'datastore'], keywords: ['database', 'persistence', 'data'],
    defaultProperties: { model: 'General' },
  },
  'database-shard': {
    id: 'database-shard', name: 'Database Shard', category: 'Databases', icon: Split,
    aliases: ['shard', 'partition'], keywords: ['database', 'partitioning', 'horizontal scaling'],
    defaultProperties: { shardKey: 'Key' },
  },

  cache: {
    id: 'cache', name: 'Cache', category: 'Caching', icon: Gauge,
    aliases: ['in memory cache', 'local cache'], keywords: ['caching', 'memory', 'latency', 'ttl'],
    defaultProperties: { scope: 'Local' },
  },
  'distributed-cache': {
    id: 'distributed-cache', name: 'Distributed Cache', category: 'Caching', icon: Layers3,
    aliases: ['shared cache', 'cache cluster'], keywords: ['caching', 'distributed', 'memory', 'cluster'],
    defaultProperties: { nodes: 3 },
  },

  'message-queue': {
    id: 'message-queue', name: 'Message Queue', category: 'Messaging', icon: ListOrdered,
    aliases: ['queue', 'job queue'], keywords: ['messaging', 'async', 'producer', 'consumer'],
    defaultProperties: { delivery: 'At least once' },
  },
  'pub-sub': {
    id: 'pub-sub', name: 'Pub/Sub', category: 'Messaging', icon: Radio,
    aliases: ['publish subscribe', 'topic'], keywords: ['messaging', 'fanout', 'publisher', 'subscriber'],
    defaultProperties: { delivery: 'Fan out' },
  },
  'event-bus': {
    id: 'event-bus', name: 'Event Bus', category: 'Messaging', icon: Cable,
    aliases: ['message bus', 'integration bus'], keywords: ['messaging', 'events', 'routing', 'decoupling'],
    defaultProperties: { routing: 'Rules' },
  },
  'event-stream': {
    id: 'event-stream', name: 'Event Stream', category: 'Messaging', icon: Activity,
    aliases: ['stream', 'event log'], keywords: ['messaging', 'streaming', 'ordered', 'replay'],
    defaultProperties: { partitions: 1 },
  },
  'dead-letter-queue': {
    id: 'dead-letter-queue', name: 'Dead Letter Queue', category: 'Messaging', icon: MailWarning,
    aliases: ['dlq', 'failed messages'], keywords: ['messaging', 'errors', 'retry', 'poison message'],
    defaultProperties: { retention: '14 days' },
  },

  'object-storage': {
    id: 'object-storage', name: 'Object Storage', category: 'Storage', icon: HardDriveUpload,
    aliases: ['blob storage', 'bucket'], keywords: ['storage', 'objects', 'files', 'durable'],
    defaultProperties: { access: 'Private' },
  },
  'file-storage': {
    id: 'file-storage', name: 'File Storage', category: 'Storage', icon: Folder,
    aliases: ['file system', 'shared files'], keywords: ['storage', 'filesystem', 'network share'],
    defaultProperties: { protocol: 'Network file system' },
  },
  'block-storage': {
    id: 'block-storage', name: 'Block Storage', category: 'Storage', icon: Disc3,
    aliases: ['volume', 'disk'], keywords: ['storage', 'block', 'persistent volume'],
    defaultProperties: { attachment: 'Single host' },
  },

  monitoring: {
    id: 'monitoring', name: 'Monitoring', category: 'Observability', icon: MonitorCheck,
    aliases: ['system monitoring', 'health monitoring'], keywords: ['observability', 'alerts', 'health', 'uptime'],
    defaultProperties: { alerts: true },
  },
  logging: {
    id: 'logging', name: 'Logging', category: 'Observability', icon: ScrollText,
    aliases: ['log aggregation', 'logs'], keywords: ['observability', 'events', 'debugging', 'audit'],
    defaultProperties: { retention: '30 days' },
  },
  metrics: {
    id: 'metrics', name: 'Metrics', category: 'Observability', icon: ChartNoAxesCombined,
    aliases: ['metric store', 'telemetry'], keywords: ['observability', 'timeseries', 'dashboard', 'measurements'],
    defaultProperties: { interval: '60 seconds' },
  },
  tracing: {
    id: 'tracing', name: 'Tracing', category: 'Observability', icon: ScanLine,
    aliases: ['distributed tracing', 'traces'], keywords: ['observability', 'spans', 'latency', 'requests'],
    defaultProperties: { sampling: '10%' },
  },

  'authentication-service': {
    id: 'authentication-service', name: 'Authentication Service', category: 'Security', icon: KeyRound,
    aliases: ['auth service', 'login service'], keywords: ['security', 'authentication', 'tokens', 'sessions'],
    defaultProperties: { protocol: 'OAuth 2.0' },
  },
  'identity-provider': {
    id: 'identity-provider', name: 'Identity Provider', category: 'Security', icon: BadgeCheck,
    aliases: ['idp', 'identity service'], keywords: ['security', 'identity', 'sso', 'federation'],
    defaultProperties: { federation: true },
  },
  'rate-limiter': {
    id: 'rate-limiter', name: 'Rate Limiter', category: 'Security', icon: Timer,
    aliases: ['throttler', 'request limiter'], keywords: ['security', 'quota', 'throttle', 'traffic'],
    defaultProperties: { limit: '1000/min' },
  },

  'search-engine': {
    id: 'search-engine', name: 'Search Engine', category: 'Other', icon: Search,
    aliases: ['search index', 'full text search'], keywords: ['indexing', 'query', 'documents', 'retrieval'],
    defaultProperties: { indexing: 'Full text' },
  },
  scheduler: {
    id: 'scheduler', name: 'Scheduler', category: 'Other', icon: CalendarClock,
    aliases: ['job scheduler', 'cron'], keywords: ['jobs', 'timers', 'automation', 'orchestration'],
    defaultProperties: { schedule: 'Periodic' },
  },
  'service-discovery': {
    id: 'service-discovery', name: 'Service Discovery', category: 'Other', icon: Waypoints,
    aliases: ['service registry', 'discovery'], keywords: ['services', 'registry', 'routing', 'health'],
    defaultProperties: { healthChecks: true },
  },
} as const satisfies Record<string, ComponentDefinition>;

export const componentRegistry = {
  ...genericComponentRegistry,
  ...technologyComponentRegistry,
};

export type ComponentId = keyof typeof componentRegistry;

export const componentDefinitions = Object.values(componentRegistry);
export const genericComponentDefinitions = Object.values(genericComponentRegistry);

export function isComponentId(value: string): value is ComponentId {
  return value in componentRegistry;
}
