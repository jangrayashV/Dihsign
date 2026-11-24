import postgresql from '../assets/technologies/postgresql.svg';
import mysql from '../assets/technologies/mysql.svg';
import mongodb from '../assets/technologies/mongodb.svg';
import apachecassandra from '../assets/technologies/apachecassandra.svg';
import elasticsearch from '../assets/technologies/elasticsearch.svg';
import redis from '../assets/technologies/redis.svg';
import apachekafka from '../assets/technologies/apachekafka.svg';
import rabbitmq from '../assets/technologies/rabbitmq.svg';
import memcached from '../assets/technologies/memcached.svg';
import nats from '../assets/technologies/natsdotio.svg';
import nginx from '../assets/technologies/nginx.svg';
import cloudflare from '../assets/technologies/cloudflare.svg';
import envoy from '../assets/technologies/envoyproxy.svg';
import traefik from '../assets/technologies/traefikproxy.svg';
import docker from '../assets/technologies/docker.svg';
import kubernetes from '../assets/technologies/kubernetes.svg';
import helm from '../assets/technologies/helm.svg';
import terraform from '../assets/technologies/terraform.svg';
import githubactions from '../assets/technologies/githubactions.svg';
import jenkins from '../assets/technologies/jenkins.svg';
import gitlab from '../assets/technologies/gitlab.svg';
import argo from '../assets/technologies/argo.svg';
import prometheus from '../assets/technologies/prometheus.svg';
import grafana from '../assets/technologies/grafana.svg';
import opentelemetry from '../assets/technologies/opentelemetry.svg';
import datadog from '../assets/technologies/datadog.svg';
import aws from '../assets/technologies/aws.svg';
import azure from '../assets/technologies/azure.svg';
import googlecloud from '../assets/technologies/googlecloud.svg';
import cloudflareR2 from '../assets/technologies/cloudflare-r2.svg';
import pytorch from '../assets/technologies/pytorch.svg';
import huggingface from '../assets/technologies/huggingface.svg';
import mlflow from '../assets/technologies/mlflow.svg';
import airflow from '../assets/technologies/apacheairflow.svg';
import spark from '../assets/technologies/apachespark.svg';
import qdrant from '../assets/technologies/qdrant.svg';
import faiss from '../assets/technologies/faiss.svg';
import pgvector from '../assets/technologies/pgvector.svg';
import type { TechnologyCategory } from './componentRegistry';

const technology = (
  name: string,
  category: TechnologyCategory,
  iconAsset: string,
  keywords: readonly string[],
  defaultProperties: Record<string, string | number | boolean>,
  options: { aliases?: readonly string[]; iconTreatment?: 'light-surface' } = {},
) => ({
  name,
  category,
  iconAsset,
  aliases: options.aliases ?? [],
  keywords,
  defaultProperties,
  library: 'technology' as const,
  iconTreatment: options.iconTreatment,
});

export const technologyComponentRegistry = {
  'tech-postgresql': { id: 'tech-postgresql', ...technology('PostgreSQL', 'Databases', postgresql, ['postgres', 'sql', 'relational', 'database'], { engine: 'PostgreSQL' }) },
  'tech-mysql': { id: 'tech-mysql', ...technology('MySQL', 'Databases', mysql, ['sql', 'relational', 'database'], { engine: 'MySQL' }) },
  'tech-mongodb': { id: 'tech-mongodb', ...technology('MongoDB', 'Databases', mongodb, ['mongo', 'nosql', 'document', 'database'], { engine: 'MongoDB' }) },
  'tech-cassandra': { id: 'tech-cassandra', ...technology('Apache Cassandra', 'Databases', apachecassandra, ['cassandra', 'nosql', 'wide column', 'distributed'], { engine: 'Cassandra' }) },
  'tech-elasticsearch': { id: 'tech-elasticsearch', ...technology('Elasticsearch', 'Databases', elasticsearch, ['elastic', 'search', 'index', 'analytics'], { engine: 'Elasticsearch' }) },

  'tech-redis': { id: 'tech-redis', ...technology('Redis', 'Caching & Messaging', redis, ['cache', 'key value', 'in memory', 'pubsub'], { role: 'Cache' }) },
  'tech-kafka': { id: 'tech-kafka', ...technology('Apache Kafka', 'Caching & Messaging', apachekafka, ['kafka', 'event stream', 'broker', 'queue'], { role: 'Event streaming' }, { iconTreatment: 'light-surface' }) },
  'tech-rabbitmq': { id: 'tech-rabbitmq', ...technology('RabbitMQ', 'Caching & Messaging', rabbitmq, ['amqp', 'broker', 'queue', 'messaging'], { role: 'Message broker' }) },
  'tech-memcached': { id: 'tech-memcached', ...technology('Memcached', 'Caching & Messaging', memcached, ['cache', 'memory', 'key value'], { role: 'Cache' }) },
  'tech-nats': { id: 'tech-nats', ...technology('NATS', 'Caching & Messaging', nats, ['nats.io', 'broker', 'pubsub', 'messaging'], { role: 'Message broker' }) },

  'tech-nginx': { id: 'tech-nginx', ...technology('NGINX', 'Networking & Delivery', nginx, ['proxy', 'web server', 'load balancer', 'ingress'], { role: 'Reverse proxy' }) },
  'tech-cloudflare': { id: 'tech-cloudflare', ...technology('Cloudflare', 'Networking & Delivery', cloudflare, ['cdn', 'dns', 'edge', 'waf'], { role: 'Edge network' }) },
  'tech-envoy': { id: 'tech-envoy', ...technology('Envoy', 'Networking & Delivery', envoy, ['proxy', 'service mesh', 'gateway', 'sidecar'], { role: 'Proxy' }) },
  'tech-traefik': { id: 'tech-traefik', ...technology('Traefik', 'Networking & Delivery', traefik, ['proxy', 'ingress', 'gateway', 'load balancer'], { role: 'Reverse proxy' }) },

  'tech-docker': { id: 'tech-docker', ...technology('Docker', 'Containers & Infrastructure', docker, ['container', 'image', 'runtime'], { role: 'Container runtime' }) },
  'tech-kubernetes': { id: 'tech-kubernetes', ...technology('Kubernetes', 'Containers & Infrastructure', kubernetes, ['k8s', 'container', 'orchestration', 'cluster'], { role: 'Orchestrator' }) },
  'tech-helm': { id: 'tech-helm', ...technology('Helm', 'Containers & Infrastructure', helm, ['kubernetes', 'chart', 'package manager'], { role: 'Kubernetes packages' }, { iconTreatment: 'light-surface' }) },
  'tech-terraform': { id: 'tech-terraform', ...technology('Terraform', 'Containers & Infrastructure', terraform, ['iac', 'infrastructure as code', 'hashicorp'], { role: 'Infrastructure as code' }) },

  'tech-github-actions': { id: 'tech-github-actions', ...technology('GitHub Actions', 'CI/CD & Development', githubactions, ['github', 'ci', 'cd', 'pipeline', 'automation'], { role: 'CI/CD' }) },
  'tech-jenkins': { id: 'tech-jenkins', ...technology('Jenkins', 'CI/CD & Development', jenkins, ['ci', 'cd', 'pipeline', 'automation'], { role: 'CI/CD' }) },
  'tech-gitlab-ci': { id: 'tech-gitlab-ci', ...technology('GitLab CI', 'CI/CD & Development', gitlab, ['gitlab', 'ci', 'cd', 'pipeline'], { role: 'CI/CD' }) },
  'tech-argo-cd': { id: 'tech-argo-cd', ...technology('Argo CD', 'CI/CD & Development', argo, ['argo', 'gitops', 'kubernetes', 'deployment'], { role: 'GitOps delivery' }) },

  'tech-prometheus': { id: 'tech-prometheus', ...technology('Prometheus', 'Observability', prometheus, ['metrics', 'monitoring', 'alerts', 'timeseries'], { signal: 'Metrics' }) },
  'tech-grafana': { id: 'tech-grafana', ...technology('Grafana', 'Observability', grafana, ['dashboard', 'metrics', 'visualization', 'monitoring'], { role: 'Dashboards' }) },
  'tech-opentelemetry': { id: 'tech-opentelemetry', ...technology('OpenTelemetry', 'Observability', opentelemetry, ['otel', 'tracing', 'metrics', 'logs', 'telemetry'], { role: 'Telemetry' }, { iconTreatment: 'light-surface' }) },
  'tech-datadog': { id: 'tech-datadog', ...technology('Datadog', 'Observability', datadog, ['monitoring', 'apm', 'logs', 'metrics'], { role: 'Observability platform' }) },

  'tech-aws': { id: 'tech-aws', ...technology('AWS', 'Cloud & Storage', aws, ['amazon web services', 'cloud', 'infrastructure'], { platform: 'AWS' }) },
  'tech-azure': { id: 'tech-azure', ...technology('Microsoft Azure', 'Cloud & Storage', azure, ['azure', 'microsoft', 'cloud', 'infrastructure'], { platform: 'Azure' }) },
  'tech-google-cloud': { id: 'tech-google-cloud', ...technology('Google Cloud', 'Cloud & Storage', googlecloud, ['gcp', 'google', 'cloud', 'infrastructure'], { platform: 'Google Cloud' }) },
  'tech-cloudflare-r2': { id: 'tech-cloudflare-r2', ...technology('Cloudflare R2', 'Cloud & Storage', cloudflareR2, ['r2', 'object storage', 'bucket', 's3'], { role: 'Object storage' }) },

  'tech-pytorch': { id: 'tech-pytorch', ...technology('PyTorch', 'AI & Data Engineering', pytorch, ['machine learning', 'deep learning', 'model', 'python'], { role: 'ML framework' }) },
  'tech-hugging-face': { id: 'tech-hugging-face', ...technology('Hugging Face', 'AI & Data Engineering', huggingface, ['transformers', 'models', 'machine learning', 'ai'], { role: 'Model platform' }) },
  'tech-mlflow': { id: 'tech-mlflow', ...technology('MLflow', 'AI & Data Engineering', mlflow, ['mlops', 'experiments', 'model registry', 'tracking'], { role: 'ML lifecycle' }) },
  'tech-airflow': { id: 'tech-airflow', ...technology('Apache Airflow', 'AI & Data Engineering', airflow, ['airflow', 'dag', 'workflow', 'orchestration', 'etl'], { role: 'Workflow orchestrator' }) },
  'tech-spark': { id: 'tech-spark', ...technology('Apache Spark', 'AI & Data Engineering', spark, ['spark', 'big data', 'processing', 'analytics'], { role: 'Data processing' }) },
  'tech-qdrant': { id: 'tech-qdrant', ...technology('Qdrant', 'AI & Data Engineering', qdrant, ['vector database', 'embeddings', 'similarity search'], { role: 'Vector database' }) },
  'tech-faiss': { id: 'tech-faiss', ...technology('FAISS', 'AI & Data Engineering', faiss, ['vector index', 'similarity search', 'embeddings', 'meta'], { role: 'Vector search' }) },
  'tech-pgvector': { id: 'tech-pgvector', ...technology('pgvector', 'AI & Data Engineering', pgvector, ['postgres', 'vector database', 'embeddings', 'similarity search'], { role: 'Vector extension' }) },
} as const;

export const technologyComponentDefinitions = Object.values(technologyComponentRegistry);
