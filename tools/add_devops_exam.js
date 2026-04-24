const fs = require('fs');
const file = 'c:/Users/ganes/OneDrive/Desktop/Clinch/examquestions.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const newData = {
  "saas-devops-production": {
    "mcq": [
      {
        "q": "Which tenant isolation strategy provides the strongest data isolation but the highest operational overhead?",
        "options": [
          "Database‑per‑tenant",
          "Schema‑per‑tenant",
          "Shared table with RLS",
          "Discriminator column"
        ],
        "ans": 0,
        "difficulty": "easy"
      },
      {
        "q": "In a real‑time event‑driven system, what is the primary role of Redis?",
        "options": [
          "Load balance HTTP requests",
          "Store long‑term user profiles",
          "Fan‑out messages to WebSocket servers",
          "Host background worker code"
        ],
        "ans": 2,
        "difficulty": "easy"
      },
      {
        "q": "What is the main purpose of branch protection in a CI/CD pipeline?",
        "options": [
          "To prevent direct pushes to main and enforce pull request checks",
          "To speed up the build process",
          "To allow developers to skip tests",
          "To automatically deploy to production"
        ],
        "ans": 0,
        "difficulty": "easy"
      },
      {
        "q": "In Kubernetes, which probe determines if a pod is ready to serve traffic?",
        "options": [
          "Liveness probe",
          "Startup probe",
          "Readiness probe",
          "Health probe"
        ],
        "ans": 2,
        "difficulty": "easy"
      },
      {
        "q": "What is the primary benefit of Workload Identity in GKE?",
        "options": [
          "It encrypts pod logs",
          "It allows pods to use GCP services without static JSON keys",
          "It speeds up container image builds",
          "It replaces Kubernetes Secrets"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "Which tool is used to scan container images for known CVEs?",
        "options": [
          "Semgrep",
          "Trivy",
          "ZAP",
          "TruffleHog"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "What is the primary role of a connection pooler like PgBouncer in front of PostgreSQL?",
        "options": [
          "To increase query speed by caching results",
          "To limit the number of concurrent database connections",
          "To encrypt data at rest",
          "To replicate data across regions"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "In structured logging, why are JSON logs preferred over raw logs?",
        "options": [
          "They use less disk space",
          "They are automatically parsed and queryable by log aggregators",
          "They are easier for humans to read",
          "They do not require a timestamp"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "What is the key principle of “no click‑ops” in infrastructure management?",
        "options": [
          "Never use the cloud console; all changes must be made through Infrastructure as Code",
          "Never use a mouse for cloud operations",
          "Only senior engineers can click in the console",
          "All changes must be done manually"
        ],
        "ans": 0,
        "difficulty": "easy"
      },
      {
        "q": "Which severity level generally describes a complete user‑facing outage?",
        "options": [
          "SEV4",
          "SEV3",
          "SEV2",
          "SEV1"
        ],
        "ans": 3,
        "difficulty": "easy"
      },
      {
        "q": "In a token bucket rate limiter, what happens when tokens are exhausted?",
        "options": [
          "The request is delayed until new tokens arrive",
          "The request is rejected immediately",
          "The bucket size increases",
          "The request is processed at a lower priority"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "What is a Software Bill of Materials (SBOM) primarily used for?",
        "options": [
          "Tracking infrastructure costs",
          "Listing all components and dependencies in software for vulnerability management",
          "Automating deployment scripts",
          "Monitoring CPU usage"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "Which Terraform command compares desired state with actual infrastructure state?",
        "options": [
          "terraform apply",
          "terraform init",
          "terraform plan",
          "terraform destroy"
        ],
        "ans": 2,
        "difficulty": "easy"
      },
      {
        "q": "What is the purpose of a readiness probe in Kubernetes?",
        "options": [
          "To restart a crashed container",
          "To inform the Service whether the pod should receive traffic",
          "To check if the application should exit",
          "To measure CPU usage"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "Which metric directly measures the real‑time experience of a WebSocket system?",
        "options": [
          "CPU utilisation",
          "Active connections count",
          "Message delivery latency (e.g., p99)",
          "Memory usage"
        ],
        "ans": 2,
        "difficulty": "easy"
      },
      {
        "q": "What is the primary purpose of Row Level Security (RLS) in a multi‑tenant database?",
        "options": [
          "To encrypt rows at rest",
          "To enforce tenant‑scoped access at the database layer",
          "To speed up queries on partitioned tables",
          "To replace application‑level authentication"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "Which technique reduces WebSocket connection cost by removing idle connections?",
        "options": [
          "Increasing the heartbeat interval",
          "Aggressive idle timeout",
          "Using a larger load balancer",
          "Adding more memory to the server"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "What is the main goal of shift‑left security?",
        "options": [
          "To move security testing to later stages of the pipeline",
          "To embed security checks as early as possible in the development lifecycle",
          "To automate all security decisions",
          "To replace manual penetration testing"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "In a runbook, what is the primary content?",
        "options": [
          "A list of all company employees",
          "Step‑by‑step instructions for diagnosing and resolving a known incident",
          "A schedule of on‑call rotations",
          "A report of past incidents"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "What does an exclusion filter in Cloud Logging do?",
        "options": [
          "It adds labels to log entries",
          "It discards matching log entries before ingestion to reduce cost",
          "It duplicates logs to multiple sinks",
          "It encrypts logs at rest"
        ],
        "ans": 1,
        "difficulty": "easy"
      },
      {
        "q": "Why is a WebSocket server considered stateful while a REST API server is stateless?",
        "options": [
          "Because WebSocket uses UDP, REST uses TCP",
          "Because a WebSocket server maintains a persistent connection and session state per client",
          "Because REST requires authentication",
          "Because WebSocket servers are always deployed as StatefulSets"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "A new deployment introduced a database migration that added a column. After rolling back the application, what problem might occur?",
        "options": [
          "The old code may write to the new column but ignore it",
          "New rows will not be visible",
          "The database will crash",
          "Nothing, rollback is always safe"
        ],
        "ans": 0,
        "difficulty": "medium"
      },
      {
        "q": "In Autopilot, you observe that your actual memory usage is 300Mi but you request 2Gi. How does this affect cost?",
        "options": [
          "You pay only for the 300Mi used",
          "You pay for the requested 2Gi, wasting money",
          "Autopilot adjusts the request downwards automatically",
          "You pay zero because memory is not billed"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "What is the best reason to use Redis Streams instead of pub/sub in a real‑time chat app?",
        "options": [
          "To reduce memory usage",
          "To guarantee at‑least‑once delivery with consumer group acknowledgements",
          "To increase throughput",
          "To support multiple channels"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "In Supabase Realtime, a limitation clients face is that it directly exposes database changes. What is a common mitigation?",
        "options": [
          "Use Docker to limit connections",
          "Build a custom WebSocket service that curates and transforms events before sending to clients",
          "Avoid using any real‑time features",
          "Run Supabase Realtime in a separate VPC"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "What is a direct consequence of failing to include a `tenant_id` filter in a query when using shared tables without RLS?",
        "options": [
          "The query will run slower",
          "The database will throw an error",
          "Data from multiple tenants may be returned, causing a data leak",
          "The connection pool will exhaust"
        ],
        "ans": 2,
        "difficulty": "medium"
      },
      {
        "q": "You are setting up CI to block on high‑severity image vulnerabilities, but a CVE is flagged in a library only used by a test tool. What is the appropriate action?",
        "options": [
          "Block the pipeline because CVEs must never be ignored",
          "Suppress the finding with a justification and expiry date, and do not block",
          "Remove the library manually",
          "Disable the scanning stage"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "Why should liveness probes be designed to avoid dependency on external services like databases?",
        "options": [
          "Because liveness probes run too frequently",
          "Because a temporary database outage could trigger pod restarts, causing a cascade failure",
          "Because Kubernetes does not allow external connections from probes",
          "Because databases are always in a different namespace"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "When using Workload Identity Federation for GitHub Actions, what happens if the GitHub repository is compromised?",
        "options": [
          "The attacker gets a long‑lived GCP service account key",
          "The attacker can exchange the OIDC token for a short‑lived access token bounded by the identity pool’s conditions",
          "Workload Identity prevents any authentication",
          "The risk remains the same as storing a JSON key in GitHub Secrets"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "In Terraform, what is the primary purpose of a remote state backend with locking?",
        "options": [
          "To speed up terraform apply",
          "To allow multiple users to safely collaborate and prevent concurrent modifications",
          "To store secrets",
          "To run Terraform in the cloud"
        ],
        "ans": 1,
        "difficulty": "medium"
      },
      {
        "q": "A customer complains that they cannot send messages after upgrading their plan. You find they are hitting a rate limit. Which limit is most likely the cause?",
        "options": [
          "A per‑user limit still set to their old plan tier",
          "A global rate limit on the API",
          "A WebSocket connection limit per IP",
          "A database connection limit"
        ],
        "ans": 0,
        "difficulty": "hard"
      },
      {
        "q": "You are scaling a WebSocket cluster using Redis pub/sub. Which metric best indicates that the Redis instance is approaching its throughput limit?",
        "options": [
          "Redis memory usage",
          "Redis connected clients count",
          "Redis instantaneous ops per second (ops/sec) approaching the benchmark for the instance size",
          "Redis key eviction rate"
        ],
        "ans": 2,
        "difficulty": "hard"
      },
      {
        "q": "In a multi‑stage pipeline, you want a DAST scan that is too noisy to block deployments but still catches critical issues. Which design best balances speed and safety?",
        "options": [
          "Make DAST a blocking stage, tuning the rules to only catch criticals",
          "Run DAST as a non‑blocking stage that generates tickets for high‑risk alerts while passing the build",
          "Only run DAST manually before a release",
          "Replace DAST with additional SAST rules"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "A WebSocket pod receives SIGTERM while clients are still sending messages. Which sequence correctly implements graceful shutdown?",
        "options": [
          "Immediately close all connections and exit",
          "Stop accepting new upgrades, send close frames with reconnect codes, drain pending messages for a grace period, then exit",
          "Restart the pod instantly",
          "Kill all Redis connections first"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "You have a table `messages` with a composite index `(channel_id, created_at DESC)`. A query filters on `tenant_id` and `channel_id` and orders by `created_at DESC`. What might happen if RLS is enforced via `current_setting('app.current_tenant_id')`?",
        "options": [
          "The index cannot be used and a full table scan occurs",
          "PostgreSQL automatically appends the `tenant_id` filter, potentially using the index efficiently if `tenant_id` is a leading column or if the index is redefined",
          "RLS policies cannot be used with composite indexes",
          "The query will fail"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "An incident occurs where the primary database disk is full. The runbook says to enable auto‑storage increase. What long‑term action should be added to the post‑incident review?",
        "options": [
          "Increase the disk manually once",
          "Set up monitoring and alerting on disk usage, and implement data archiving policies",
          "Delete all logs",
          "Move to a larger instance type immediately"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "In a Kubernetes HPA targeting CPU, why might scaling not happen despite high average CPU?",
        "options": [
          "HPA only works for memory",
          "The HPA may be limited by `maxReplicas`, or the metric server is unavailable",
          "CPU metrics are always inaccurate",
          "HPA requires manual intervention"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "When generating an SBOM, what is a key difference between building it at the source code level versus the container image level?",
        "options": [
          "Source code SBOMs are always smaller",
          "Container image SBOM captures all OS packages and runtime dependencies, providing a more complete inventory",
          "Source code SBOM is in CycloneDX, container in SPDX",
          "Container SBOM cannot list transitive dependencies"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "A tenant is consistently hitting their storage quota. You have implemented a soft quota at 80% and hard at 100%. At 100%, the system should:",
        "options": [
          "Reject write operations but allow reads and show an upsell message",
          "Drop existing data",
          "Shut down the tenant",
          "Notify only the admin"
        ],
        "ans": 0,
        "difficulty": "hard"
      },
      {
        "q": "In a cost‑engineering exercise, you discover that logging of health‑check probes accounts for 20% of log volume. The best immediate action is:",
        "options": [
          "Downgrade the logging plan",
          "Configure an exclusion filter to drop logs matching health‑check paths before ingestion",
          "Stop health checks",
          "Compress logs"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "You want to enforce the principle 'no long‑lived JSON keys anywhere' in an existing project. What is the most effective technical control to prevent new keys?",
        "options": [
          "Send a team email",
          "Enable the GCP organization policy `constraints/iam.disableServiceAccountKeyCreation`",
          "Delete all existing keys",
          "Use only user accounts"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "A developer bypasses a CI security stage by pushing a commit that alters the pipeline definition. How can you prevent this in the future?",
        "options": [
          "Use branch protection that requires a separate review for pipeline configuration changes",
          "Disable all developer access",
          "Add more security scans",
          "Remove the pipeline entirely"
        ],
        "ans": 0,
        "difficulty": "hard"
      },
      {
        "q": "In a complex real‑time system, a user reports that they missed a message sent while they were temporarily disconnected. What reconciliation strategy should be in place?",
        "options": [
          "Re‑send all messages via Redis pub/sub",
          "The client stores a cursor of the last received message ID and receives the missed messages from the database on reconnect",
          "The server replays the entire message history",
          "The client polls the database every second"
        ],
        "ans": 1,
        "difficulty": "hard"
      },
      {
        "q": "You are designing an SLO for WebSocket delivery latency. The error budget must reflect the user experience. Which of the following is a valid SLO target with a reasonable burn‑rate alert?",
        "options": [
          "\"100% of messages delivered within 100ms\"",
          "\"99.9% of messages delivered within 300ms over a 30‑day window; fire a critical alert if the 2% burn rate threshold is exceeded within 1 hour\"",
          "\"90% of connections remain open\"",
          "\"No alerts until 100% failure\""
        ],
        "ans": 1,
        "difficulty": "ultra-hard"
      },
      {
        "q": "You are migrating a self‑hosted Redis to Memorystore for a critical real‑time service. During the cutover, you must minimize latency and message loss. Which approach is correct?",
        "options": [
          "Switch the service to use a dummy Redis, then swap",
          "Pre‑load the new Redis with keys, then switch traffic atomically using a config change that reloads without restarting the WebSocket servers (e.g., feature flag)",
          "Stop all writes, backup, restore, start writes",
          "Change DNS and wait for propagation"
        ],
        "ans": 1,
        "difficulty": "ultra-hard"
      },
      {
        "q": "In a Slack‑style chat SaaS, a tenant uses an API key to send messages. The key is leaked and used to spam 1000 messages/second. Which defense layers will contain the blast radius most effectively?",
        "options": [
          "A single per‑tenant rate limit of 500 msg/s",
          "A combination of per‑user rate limit, per‑tenant rate limit, payload size control, and anomaly detection that revokes the key when abnormal patterns appear",
          "Only a WebSocket connection limit",
          "No limit, the database will just reject writes"
        ],
        "ans": 1,
        "difficulty": "ultra-hard"
      },
      {
        "q": "When configuring HPA for a WebSocket service based on custom metrics like `active_connections`, what additional tuning is necessary to handle a connection storm (e.g., during a service recovery)?",
        "options": [
          "Set `minReplicas` to a high number",
          "Tune the scale‑up window (e.g., add at most 5 pods per minute) and ensure the metric is smoothed to prevent over‑scaling and cost spikes",
          "Disable scale‑down permanently",
          "Use only CPU‑based scaling"
        ],
        "ans": 1,
        "difficulty": "ultra-hard"
      },
      {
        "q": "You need to roll back a deployment that included a database migration dropping a column. Which steps will ensure zero data loss and minimal downtime?",
        "options": [
          "Run `kubectl rollout undo` and ignore the column",
          "Restore the database from a backup, then redeploy the old application version",
          "Re‑deploy a previous image that still writes to all columns, then alter the table to re‑add the column with a default or backfill, and only then remove the new application version",
          "Rename the column in the migration to fool the old code"
        ],
        "ans": 2,
        "difficulty": "ultra-hard"
      }
    ]
  }
};
data['saas-devops-production'] = newData['saas-devops-production'];
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('Exam added successfully!');
