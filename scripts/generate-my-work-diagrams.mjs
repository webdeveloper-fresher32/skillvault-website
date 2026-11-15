import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('../frontend/node_modules/sharp');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, '..', 'frontend', 'public', 'images', 'my-work');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// ==============================================================================
// DIAGRAM 1: Stripe Billing & Webhook Event Lifecycle (Sequence Diagram)
// ==============================================================================
function generateDiagram1Svg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1500" height="1200" viewBox="0 0 1500 1200" xmlns="http://www.w3.org/2000/svg" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070a13"/>
      <stop offset="100%" stop-color="#0a0f1d"/>
    </linearGradient>
    <linearGradient id="primaryBox" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="stripeBox" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b0764"/>
      <stop offset="100%" stop-color="#581c87"/>
    </linearGradient>
    <linearGradient id="postgresBox" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#065f46"/>
    </linearGradient>
    <linearGradient id="noteBox" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#2e1065"/>
    </linearGradient>
    
    <!-- Arrow Marker -->
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/>
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34d399"/>
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#c084fc"/>
    </marker>
    <marker id="arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24"/>
    </marker>
  </defs>

  <!-- Background Canvas -->
  <rect width="1500" height="1200" rx="16" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="2"/>

  <!-- Top Title Banner -->
  <rect x="30" y="25" width="1440" height="70" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.3"/>
  <text x="50" y="56" fill="#38bdf8" font-size="20" font-weight="800" letter-spacing="0.5">STRIPE BILLING &amp; SUBSCRIPTION EVENT MACHINE</text>
  <text x="50" y="78" fill="#94a3b8" font-size="13" font-weight="500">End-to-End Distributed 2PC Lifecycle: Checkout Initiation, 3DS Auth, and Asynchronous Webhook State Machine</text>
  
  <rect x="1310" y="42" width="140" height="28" rx="6" fill="#38bdf8" fill-opacity="0.15" stroke="#38bdf8" stroke-width="1"/>
  <text x="1380" y="61" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="middle">PRODUCTION ARCH</text>

  <!-- Lifeline X Coordinates:
       1. Customer (120)
       2. React Frontend (340)
       3. Express API (570)
       4. PostgreSQL (800)
       5. Stripe API (1030)
       6. Redis / BullMQ (1230)
       7. Webhook Worker (1400)
  -->

  <!-- Lifeline Dashed Columns -->
  <g stroke="#334155" stroke-width="1.5" stroke-dasharray="6,6">
    <line x1="120" y1="170" x2="120" y2="1140"/>
    <line x1="340" y1="170" x2="340" y2="1140"/>
    <line x1="570" y1="170" x2="570" y2="1140"/>
    <line x1="800" y1="170" x2="800" y2="1140"/>
    <line x1="1030" y1="170" x2="1030" y2="1140"/>
    <line x1="1230" y1="170" x2="1230" y2="1140"/>
    <line x1="1400" y1="170" x2="1400" y2="1140"/>
  </g>

  <!-- Header Participants Boxes -->
  <!-- 1. Customer -->
  <g transform="translate(45, 115)">
    <rect width="150" height="52" rx="10" fill="url(#primaryBox)" stroke="#38bdf8" stroke-width="1.5"/>
    <circle cx="35" cy="26" r="12" fill="#38bdf8" fill-opacity="0.2"/>
    <text x="35" y="30" fill="#38bdf8" font-size="12" font-weight="700" text-anchor="middle">👤</text>
    <text x="105" y="27" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">Customer</text>
    <text x="105" y="42" fill="#94a3b8" font-size="10" font-weight="500" text-anchor="middle">Browser / Client</text>
  </g>

  <!-- 2. React Frontend -->
  <g transform="translate(265, 115)">
    <rect width="150" height="52" rx="10" fill="url(#primaryBox)" stroke="#06b6d4" stroke-width="1.5"/>
    <text x="75" y="27" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">React Frontend</text>
    <text x="75" y="42" fill="#06b6d4" font-size="10" font-weight="600" text-anchor="middle">Next.js / TypeScript</text>
  </g>

  <!-- 3. Express API -->
  <g transform="translate(495, 115)">
    <rect width="150" height="52" rx="10" fill="url(#primaryBox)" stroke="#818cf8" stroke-width="1.5"/>
    <text x="75" y="27" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">Express Server</text>
    <text x="75" y="42" fill="#818cf8" font-size="10" font-weight="600" text-anchor="middle">API Gateway (JWT)</text>
  </g>

  <!-- 4. PostgreSQL -->
  <g transform="translate(725, 115)">
    <rect width="150" height="52" rx="10" fill="url(#postgresBox)" stroke="#34d399" stroke-width="1.5"/>
    <text x="75" y="27" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">PostgreSQL DB</text>
    <text x="75" y="42" fill="#34d399" font-size="10" font-weight="600" text-anchor="middle">Prisma (ACID Locks)</text>
  </g>

  <!-- 5. Stripe API -->
  <g transform="translate(955, 115)">
    <rect width="150" height="52" rx="10" fill="url(#stripeBox)" stroke="#c084fc" stroke-width="1.5"/>
    <text x="75" y="27" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">Stripe API</text>
    <text x="75" y="42" fill="#c084fc" font-size="10" font-weight="600" text-anchor="middle">Financial Ledger</text>
  </g>

  <!-- 6. Redis / BullMQ -->
  <g transform="translate(1155, 115)">
    <rect width="150" height="52" rx="10" fill="url(#primaryBox)" stroke="#fbbf24" stroke-width="1.5"/>
    <text x="75" y="27" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">Redis / BullMQ</text>
    <text x="75" y="42" fill="#fbbf24" font-size="10" font-weight="600" text-anchor="middle">Distributed Queue</text>
  </g>

  <!-- 7. Webhook Worker -->
  <g transform="translate(1325, 115)">
    <rect width="150" height="52" rx="10" fill="url(#primaryBox)" stroke="#fb7185" stroke-width="1.5"/>
    <text x="75" y="27" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">Webhook Worker</text>
    <text x="75" y="42" fill="#fb7185" font-size="10" font-weight="600" text-anchor="middle">Background Consumer</text>
  </g>

  <!-- ================= SEQUENCE INTERACTIONS ================= -->

  <!-- Step 1: Customer selects plan -->
  <g transform="translate(0, 195)">
    <circle cx="120" cy="15" r="10" fill="#38bdf8"/>
    <text x="120" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">1</text>
    <line x1="120" y1="15" x2="335" y2="15" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
    <text x="227" y="9" fill="#e2e8f0" font-size="12" font-weight="600" text-anchor="middle">Selects Pro Plan ($49/mo)</text>
  </g>

  <!-- Step 2: React calls API -->
  <g transform="translate(0, 245)">
    <circle cx="340" cy="15" r="10" fill="#38bdf8"/>
    <text x="340" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">2</text>
    <line x1="340" y1="15" x2="565" y2="15" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
    <text x="455" y="9" fill="#e2e8f0" font-size="12" font-weight="600" text-anchor="middle">POST /api/v1/billing/checkout-session { planId }</text>
  </g>

  <!-- Step 3: Auth & Tenant Context Note -->
  <g transform="translate(450, 285)">
    <rect width="240" height="40" rx="8" fill="url(#noteBox)" stroke="#818cf8" stroke-width="1"/>
    <text x="570" y="302" fill="#a5b4fc" font-size="11" font-weight="600" text-anchor="middle">🔒 Authenticate JWT &amp; Extract Tenant ID</text>
    <text x="570" y="318" fill="#cbd5e1" font-size="10" text-anchor="middle">Client cannot forge active organization</text>
  </g>

  <!-- Step 4: Query User in Postgres -->
  <g transform="translate(0, 345)">
    <circle cx="570" cy="15" r="10" fill="#34d399"/>
    <text x="570" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">3</text>
    <line x1="570" y1="15" x2="795" y2="15" stroke="#34d399" stroke-width="2" marker-end="url(#arrow-green)"/>
    <text x="685" y="9" fill="#e2e8f0" font-size="12" font-weight="600" text-anchor="middle">Query User &amp; existing stripe_customer_id</text>
  </g>

  <!-- Step 5: Express creates Checkout Session with Stripe -->
  <g transform="translate(0, 395)">
    <circle cx="570" cy="15" r="10" fill="#c084fc"/>
    <text x="570" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">4</text>
    <line x1="570" y1="15" x2="1025" y2="15" stroke="#c084fc" stroke-width="2" marker-end="url(#arrow-purple)"/>
    <text x="800" y="9" fill="#e2e8f0" font-size="12" font-weight="600" text-anchor="middle">stripe.checkout.sessions.create({ customer, mode: 'subscription', idempotencyKey })</text>
  </g>

  <!-- Step 6: Stripe returns session URL -->
  <g transform="translate(0, 445)">
    <line x1="1030" y1="15" x2="575" y2="15" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4" marker-end="url(#arrow)"/>
    <text x="800" y="9" fill="#cbd5e1" font-size="11" font-weight="500" text-anchor="middle">Returns { id: "cs_123", url: "https://checkout.stripe.com/..." }</text>
  </g>

  <!-- Step 7: Express returns URL to React -->
  <g transform="translate(0, 485)">
    <line x1="570" y1="15" x2="345" y2="15" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4" marker-end="url(#arrow)"/>
    <text x="455" y="9" fill="#cbd5e1" font-size="11" font-weight="500" text-anchor="middle">{ checkoutUrl: "https://checkout.stripe.com/..." }</text>
  </g>

  <!-- Step 8: Redirect to Stripe Hosted Checkout -->
  <g transform="translate(0, 525)">
    <circle cx="340" cy="15" r="10" fill="#38bdf8"/>
    <text x="340" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">5</text>
    <line x1="340" y1="15" x2="125" y2="15" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
    <text x="230" y="9" fill="#e2e8f0" font-size="12" font-weight="600" text-anchor="middle">Redirect to Stripe Hosted Checkout</text>
  </g>

  <!-- Step 9: User submits card to Stripe -->
  <g transform="translate(0, 570)">
    <circle cx="120" cy="15" r="10" fill="#c084fc"/>
    <text x="120" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">6</text>
    <line x1="120" y1="15" x2="1025" y2="15" stroke="#c084fc" stroke-width="2" marker-end="url(#arrow-purple)"/>
    <text x="575" y="9" fill="#e2e8f0" font-size="12" font-weight="600" text-anchor="middle">Submits Credit Card (PCI DSS compliant tokenization &amp; 3D Secure Challenge)</text>
  </g>

  <!-- Step 10: Stripe authorizes charge (internal loop) -->
  <g transform="translate(1030, 605)">
    <path d="M 0 5 C 60 5, 60 40, 5 40" fill="none" stroke="#c084fc" stroke-width="2" marker-end="url(#arrow-purple)"/>
    <text x="75" y="25" fill="#e9d5ff" font-size="11" font-weight="600">Authorize &amp; Capture Charge ($49.00)</text>
  </g>

  <!-- Step 11: Stripe redirects user back to app -->
  <g transform="translate(0, 665)">
    <circle cx="1030" cy="15" r="10" fill="#38bdf8"/>
    <text x="1030" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">7</text>
    <line x1="1030" y1="15" x2="125" y2="15" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrow)"/>
    <text x="575" y="9" fill="#e2e8f0" font-size="12" font-weight="600" text-anchor="middle">Browser Redirect: /billing/success?session_id=cs_123</text>
  </g>

  <!-- ================= PARALLEL CONTAINER BLOCKS ================= -->
  <!-- PARALLEL BLOCK 1: Client Return -->
  <g transform="translate(45, 715)">
    <rect width="700" height="150" rx="10" fill="#0f172a" fill-opacity="0.6" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6,4"/>
    <rect x="0" y="0" width="220" height="24" rx="6" fill="#38bdf8" fill-opacity="0.2"/>
    <text x="10" y="16" fill="#38bdf8" font-size="11" font-weight="800">PAR: SYNCHRONOUS CLIENT RETURN</text>

    <!-- Interactions inside client return -->
    <g transform="translate(0, 35)">
      <line x1="75" y1="15" x2="290" y2="15" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#arrow)"/>
      <text x="180" y="9" fill="#cbd5e1" font-size="11" text-anchor="middle">Lands on /billing/success</text>

      <line x1="295" y1="45" x2="520" y2="45" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#arrow)"/>
      <text x="407" y="39" fill="#cbd5e1" font-size="11" text-anchor="middle">GET /api/v1/billing/subscription-status</text>

      <line x1="525" y1="75" x2="295" y2="75" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4" marker-end="url(#arrow)"/>
      <text x="410" y="69" fill="#94a3b8" font-size="11" text-anchor="middle">Returns { status: "PROCESSING" } (Optimistic poll until webhook commits)</text>
    </g>
  </g>

  <!-- PARALLEL BLOCK 2: Asynchronous Webhook Guarantee -->
  <g transform="translate(45, 885)">
    <rect width="1410" height="235" rx="10" fill="#0f172a" fill-opacity="0.7" stroke="#34d399" stroke-width="1.5"/>
    <rect x="0" y="0" width="280" height="24" rx="6" fill="#34d399" fill-opacity="0.2"/>
    <text x="10" y="16" fill="#34d399" font-size="11" font-weight="800">AND: ASYNCHRONOUS WEBHOOK GUARANTEE (2PC TRUTH)</text>

    <!-- Step A: Webhook delivery -->
    <g transform="translate(0, 35)">
      <circle cx="985" cy="15" r="10" fill="#34d399"/>
      <text x="985" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">8</text>
      <line x1="985" y1="15" x2="530" y2="15" stroke="#34d399" stroke-width="2" marker-end="url(#arrow-green)"/>
      <text x="750" y="9" fill="#34d399" font-size="12" font-weight="700" text-anchor="middle">POST /api/v1/webhooks/stripe (Event: checkout.session.completed)</text>
    </g>

    <!-- Step B: Validation & BullMQ enqueue note -->
    <g transform="translate(380, 70)">
      <rect width="380" height="42" rx="6" fill="#1e1b4b" stroke="#818cf8" stroke-width="1"/>
      <text x="190" y="16" fill="#c7d2fe" font-size="10" font-weight="600" text-anchor="middle">1. Validate HMAC (stripe.webhooks.constructEvent)</text>
      <text x="190" y="32" fill="#e0e7ff" font-size="10" text-anchor="middle">2. Redis SET NX idempotency lock • 3. Enqueue BullMQ job</text>
    </g>

    <!-- Step C: 200 OK immediate ack -->
    <g transform="translate(0, 115)">
      <line x1="525" y1="15" x2="980" y2="15" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,4" marker-end="url(#arrow-green)"/>
      <text x="750" y="9" fill="#cbd5e1" font-size="11" text-anchor="middle">200 OK (Immediate Ack within 200ms - Prevents Stripe timeout retry storms)</text>
    </g>

    <!-- Step D: BullMQ pushes to worker -->
    <g transform="translate(0, 145)">
      <circle cx="1185" cy="15" r="10" fill="#fbbf24"/>
      <text x="1185" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">9</text>
      <line x1="1185" y1="15" x2="1350" y2="15" stroke="#fbbf24" stroke-width="2" marker-end="url(#arrow-amber)"/>
      <text x="1270" y="9" fill="#fde68a" font-size="11" font-weight="600" text-anchor="middle">Consume job</text>
    </g>

    <!-- Step E: Worker executes ACID transaction -->
    <g transform="translate(0, 175)">
      <circle cx="1355" cy="15" r="10" fill="#34d399"/>
      <text x="1355" y="19" fill="#070b14" font-size="10" font-weight="800" text-anchor="middle">10</text>
      <line x1="1355" y1="15" x2="760" y2="15" stroke="#34d399" stroke-width="2" marker-end="url(#arrow-green)"/>
      <text x="1055" y="9" fill="#e2e8f0" font-size="12" font-weight="700" text-anchor="middle">BEGIN Transaction: Lock User row (SELECT FOR UPDATE), Upsert Subscription, Record Audit Event</text>
    </g>

    <!-- Step F: Transaction committed -->
    <g transform="translate(0, 205)">
      <line x1="755" y1="15" x2="1350" y2="15" stroke="#34d399" stroke-width="1.5" stroke-dasharray="4,4" marker-end="url(#arrow-green)"/>
      <text x="1055" y="9" fill="#6ee7b7" font-size="11" font-weight="600" text-anchor="middle">COMMIT Transaction (status='ACTIVE', plan='PRO') — Final Consistency Achieved</text>
    </g>
  </g>
</svg>`;
}

// ==============================================================================
// DIAGRAM 2: Subscription Lifecycle State Machine
// ==============================================================================
function generateDiagram2Svg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1350" height="750" viewBox="0 0 1350 750" xmlns="http://www.w3.org/2000/svg" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070a13"/>
      <stop offset="100%" stop-color="#0a0f1d"/>
    </linearGradient>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/>
    </marker>
    <marker id="arr-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34d399"/>
    </marker>
    <marker id="arr-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e"/>
    </marker>
    <marker id="arr-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24"/>
    </marker>
  </defs>

  <rect width="1350" height="750" rx="16" fill="url(#bgGrad2)" stroke="#1e293b" stroke-width="2"/>

  <!-- Title Banner -->
  <rect x="30" y="25" width="1290" height="65" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.3"/>
  <text x="50" y="54" fill="#38bdf8" font-size="19" font-weight="800">SAAS SUBSCRIPTION STATE MACHINE &amp; DUNNING LIFECYCLE</text>
  <text x="50" y="74" fill="#94a3b8" font-size="12">7-Stage state transitions handling 3DS payment authentication, smart retries, grace periods, and dunning</text>

  <!-- Start Circle -->
  <circle cx="80" cy="220" r="16" fill="#38bdf8"/>
  <text x="80" y="255" fill="#94a3b8" font-size="11" text-anchor="middle">Initial</text>
  <line x1="96" y1="220" x2="165" y2="220" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr)"/>
  <text x="130" y="210" fill="#cbd5e1" font-size="10" text-anchor="middle">Checkout</text>

  <!-- State 1: Incomplete -->
  <g transform="translate(170, 185)">
    <rect width="160" height="70" rx="12" fill="#1e1b4b" stroke="#facc15" stroke-width="2"/>
    <text x="80" y="32" fill="#fef08a" font-size="15" font-weight="800" text-anchor="middle">INCOMPLETE</text>
    <text x="80" y="52" fill="#cbd5e1" font-size="10" text-anchor="middle">Awaiting 3DS / Card Auth</text>
  </g>

  <!-- Incomplete -> Incomplete Expired -->
  <line x1="250" y1="255" x2="250" y2="365" stroke="#f43f5e" stroke-width="1.5" marker-end="url(#arr-red)"/>
  <text x="260" y="315" fill="#fca5a5" font-size="10">23h Timeout</text>

  <!-- State: Incomplete_Expired -->
  <g transform="translate(170, 375)">
    <rect width="160" height="60" rx="10" fill="#2a1215" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4,4"/>
    <text x="80" y="28" fill="#fda4af" font-size="13" font-weight="700" text-anchor="middle">INCOMPLETE_EXPIRED</text>
    <text x="80" y="46" fill="#94a3b8" font-size="10" text-anchor="middle">Cart Abandoned (Purged)</text>
  </g>

  <!-- Incomplete -> Active -->
  <line x1="330" y1="220" x2="480" y2="220" stroke="#34d399" stroke-width="2.5" marker-end="url(#arr-green)"/>
  <text x="405" y="210" fill="#6ee7b7" font-size="11" font-weight="700" text-anchor="middle">Payment Confirmed</text>

  <!-- State 2: Active -->
  <g transform="translate(485, 175)">
    <rect width="200" height="90" rx="14" fill="#064e3b" stroke="#34d399" stroke-width="2.5"/>
    <text x="100" y="35" fill="#a7f3d0" font-size="18" font-weight="900" text-anchor="middle">ACTIVE</text>
    <text x="100" y="55" fill="#f0fdf4" font-size="11" font-weight="600" text-anchor="middle">Good Standing</text>
    <text x="100" y="73" fill="#cbd5e1" font-size="10" text-anchor="middle">Full SaaS Access Granted</text>
  </g>

  <!-- Active -> Trialing (top branch) -->
  <path d="M 540 175 C 540 110, 400 110, 400 110" fill="none" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#arr)"/>
  
  <!-- State: Trialing -->
  <g transform="translate(320, 80)">
    <rect width="160" height="55" rx="10" fill="#0c2d48" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="80" y="27" fill="#bae6fd" font-size="14" font-weight="700" text-anchor="middle">TRIALING</text>
    <text x="80" y="43" fill="#94a3b8" font-size="10" text-anchor="middle">Free Trial Active</text>
  </g>
  <path d="M 480 110 C 620 110, 620 175, 620 175" fill="none" stroke="#34d399" stroke-width="1.5" marker-end="url(#arr-green)"/>
  <text x="560" y="100" fill="#6ee7b7" font-size="10">Trial Converted</text>

  <!-- Active -> Past Due (Renewal Failed) -->
  <line x1="685" y1="220" x2="835" y2="220" stroke="#fb923c" stroke-width="2" marker-end="url(#arr-amber)"/>
  <text x="760" y="210" fill="#fdba74" font-size="11" font-weight="600" text-anchor="middle">Renewal Failed</text>

  <!-- State 3: Past Due -->
  <g transform="translate(840, 175)">
    <rect width="190" height="90" rx="14" fill="#451a03" stroke="#fb923c" stroke-width="2"/>
    <text x="95" y="35" fill="#fed7aa" font-size="17" font-weight="800" text-anchor="middle">PAST_DUE</text>
    <text x="95" y="55" fill="#fef3c7" font-size="11" font-weight="600" text-anchor="middle">Grace Period (7–14 Days)</text>
    <text x="95" y="73" fill="#cbd5e1" font-size="10" text-anchor="middle">Smart Retries Running</text>
  </g>

  <!-- Past Due -> Active (Smart Retry Succeeded) -->
  <path d="M 850 265 C 780 310, 650 310, 580 265" fill="none" stroke="#34d399" stroke-width="2" marker-end="url(#arr-green)"/>
  <text x="715" y="315" fill="#6ee7b7" font-size="11" font-weight="700" text-anchor="middle">✓ Smart Retries Recovered Payment</text>

  <!-- Past Due -> Unpaid -->
  <line x1="935" y1="265" x2="935" y2="400" stroke="#ef4444" stroke-width="2" marker-end="url(#arr-red)"/>
  <text x="945" y="340" fill="#fca5a5" font-size="11" font-weight="600">All Retries Failed</text>

  <!-- State 4: Unpaid -->
  <g transform="translate(845, 405)">
    <rect width="180" height="80" rx="12" fill="#450a0a" stroke="#ef4444" stroke-width="2"/>
    <text x="90" y="32" fill="#fecaca" font-size="16" font-weight="800" text-anchor="middle">UNPAID</text>
    <text x="90" y="52" fill="#f87171" font-size="11" font-weight="600" text-anchor="middle">Features Suspended</text>
    <text x="90" y="68" fill="#cbd5e1" font-size="10" text-anchor="middle">Customer Data Retained</text>
  </g>

  <!-- Unpaid -> Active (Customer updates card in portal) -->
  <path d="M 845 445 C 500 520, 500 320, 500 270" fill="none" stroke="#34d399" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arr-green)"/>
  <text x="610" y="470" fill="#6ee7b7" font-size="11" font-weight="600" text-anchor="middle">Customer Updates Card via Billing Portal</text>

  <!-- Active -> Canceled -->
  <path d="M 585 175 C 585 80, 1150 80, 1150 170" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="860" y="70" fill="#cbd5e1" font-size="11" text-anchor="middle">Immediate / End-of-Period Cancellation</text>

  <!-- Unpaid -> Canceled -->
  <line x1="1025" y1="445" x2="1140" y2="270" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="1100" y="380" fill="#cbd5e1" font-size="10">Purge Policy</text>

  <!-- State 5: Canceled -->
  <g transform="translate(1070, 180)">
    <rect width="160" height="80" rx="12" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="80" y="32" fill="#f1f5f9" font-size="16" font-weight="800" text-anchor="middle">CANCELED</text>
    <text x="80" y="52" fill="#94a3b8" font-size="11" font-weight="600" text-anchor="middle">Subscription Ended</text>
    <text x="80" y="68" fill="#64748b" font-size="10" text-anchor="middle">Downgraded to Free Tier</text>
  </g>

  <!-- Legend Bottom Bar -->
  <g transform="translate(50, 680)">
    <rect width="1250" height="40" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1"/>
    <circle cx="40" cy="20" r="6" fill="#34d399"/>
    <text x="55" y="24" fill="#cbd5e1" font-size="11">Active Good Standing</text>
    <circle cx="230" cy="20" r="6" fill="#fb923c"/>
    <text x="245" y="24" fill="#cbd5e1" font-size="11">Grace Period (Smart Retries)</text>
    <circle cx="480" cy="20" r="6" fill="#ef4444"/>
    <text x="495" y="24" fill="#cbd5e1" font-size="11">Suspended (Features Locked)</text>
    <circle cx="730" cy="20" r="6" fill="#94a3b8"/>
    <text x="745" y="24" fill="#cbd5e1" font-size="11">Terminal Canceled</text>
    <text x="1220" y="24" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="end">STRIPE BILLING LIFECYCLE</text>
  </g>
</svg>`;
}

// ==============================================================================
// DIAGRAM 3: Multi-Tenant AI Support & RAG System Topology
// ==============================================================================
function generateDiagram3Svg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1450" height="1000" viewBox="0 0 1450 1000" xmlns="http://www.w3.org/2000/svg" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bgGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070a13"/>
      <stop offset="100%" stop-color="#0a0f1d"/>
    </linearGradient>
    <marker id="arr3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/>
    </marker>
    <marker id="arr-green3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34d399"/>
    </marker>
    <marker id="arr-purple3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#c084fc"/>
    </marker>
    <marker id="arr-amber3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24"/>
    </marker>
  </defs>

  <rect width="1450" height="1000" rx="16" fill="url(#bgGrad3)" stroke="#1e293b" stroke-width="2"/>

  <!-- Title Banner -->
  <rect x="30" y="25" width="1390" height="70" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.3"/>
  <text x="50" y="55" fill="#38bdf8" font-size="20" font-weight="800">MULTI-TENANT AI SUPPORT &amp; RAG PLATFORM TOPOLOGY</text>
  <text x="50" y="77" fill="#94a3b8" font-size="12">Asynchronous Ingestion Pipeline, 3-Layer Tenant Isolation, LangGraph Cyclic State Machine, and Isolated Storage Tier</text>

  <!-- 1. Client & Gateway Layer -->
  <g transform="translate(50, 120)">
    <!-- Client -->
    <rect width="320" height="85" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
    <text x="160" y="32" fill="#f8fafc" font-size="14" font-weight="700" text-anchor="middle">Frontend Client (React + SSE)</text>
    <text x="160" y="52" fill="#38bdf8" font-size="11" text-anchor="middle">Markdown Rendering &amp; Syntax Highlighting</text>
    <text x="160" y="68" fill="#94a3b8" font-size="10" text-anchor="middle">EventSource Streaming / Token Receiver</text>

    <!-- Arrow from Client to Gateway -->
    <line x1="320" y1="42" x2="435" y2="42" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr3)"/>
    <text x="375" y="34" fill="#94a3b8" font-size="10" text-anchor="middle">JWT Bearer</text>

    <!-- Gateway -->
    <g transform="translate(440, 0)">
      <rect width="450" height="85" rx="12" fill="#111827" stroke="#34d399" stroke-width="2"/>
      <text x="225" y="30" fill="#f8fafc" font-size="15" font-weight="800" text-anchor="middle">FastAPI API Gateway</text>
      <text x="225" y="50" fill="#34d399" font-size="11" font-weight="600" text-anchor="middle">Layer 1 Isolation: Cryptographic JWT Tenant Extraction</text>
      <text x="225" y="68" fill="#cbd5e1" font-size="10" text-anchor="middle">Enforces org_id &amp; user_id • SSE Streaming Endpoint (/chat/stream)</text>
    </g>
  </g>

  <!-- 2. Subgraph Box: Ingestion Pipeline (Left) -->
  <g transform="translate(50, 240)">
    <rect width="420" height="420" rx="14" fill="#0c1322" stroke="#f59e0b" stroke-width="1.5"/>
    <rect x="0" y="0" width="420" height="32" rx="8" fill="#f59e0b" fill-opacity="0.15"/>
    <text x="15" y="21" fill="#fbbf24" font-size="12" font-weight="800">ASYNCHRONOUS DOCUMENT INGESTION PIPELINE</text>

    <!-- S3 Storage -->
    <g transform="translate(20, 50)">
      <rect width="380" height="60" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
      <text x="190" y="26" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">1. S3 / MinIO Object Storage</text>
      <text x="190" y="44" fill="#cbd5e1" font-size="10" text-anchor="middle">Raw PDFs, DOCX, Markdown with SHA-256 Hash Deduplication</text>
    </g>

    <line x1="210" y1="110" x2="210" y2="135" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arr-amber3)"/>

    <!-- Celery Worker -->
    <g transform="translate(20, 140)">
      <rect width="380" height="60" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
      <text x="190" y="26" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">2. Celery Distributed Worker</text>
      <text x="190" y="44" fill="#cbd5e1" font-size="10" text-anchor="middle">Redis Task Queue • Non-blocking Background Ingestion Jobs</text>
    </g>

    <line x1="210" y1="200" x2="210" y2="225" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arr-amber3)"/>

    <!-- Token-Aware Chunker -->
    <g transform="translate(20, 230)">
      <rect width="380" height="60" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
      <text x="190" y="26" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">3. Token-Aware Semantic Chunker</text>
      <text x="190" y="44" fill="#cbd5e1" font-size="10" text-anchor="middle">800 tokens, 120 overlap • Preserves H2/H3 &amp; Page Numbers</text>
    </g>

    <line x1="210" y1="290" x2="210" y2="315" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arr-amber3)"/>

    <!-- Embedding Generator -->
    <g transform="translate(20, 320)">
      <rect width="380" height="65" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
      <text x="190" y="26" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">4. Embedding Engine (text-embedding-3-small)</text>
      <text x="190" y="44" fill="#cbd5e1" font-size="10" text-anchor="middle">1536-Dimensional Dense Vectors</text>
      <text x="190" y="58" fill="#34d399" font-size="10" font-weight="600" text-anchor="middle">Batched Upsert with Tenant Isolation Policy</text>
    </g>
  </g>

  <!-- 3. Subgraph Box: LangGraph State Machine (Right) -->
  <g transform="translate(510, 240)">
    <rect width="890" height="420" rx="14" fill="#0c1322" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="0" y="0" width="890" height="32" rx="8" fill="#818cf8" fill-opacity="0.15"/>
    <text x="15" y="21" fill="#c7d2fe" font-size="12" font-weight="800">LANGGRAPH AGENTIC WORKFLOW &amp; STATE MACHINE</text>

    <!-- Node 1: Intent Classifier -->
    <g transform="translate(30, 50)">
      <rect width="250" height="60" rx="10" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.5"/>
      <text x="125" y="26" fill="#e0e7ff" font-size="12" font-weight="700" text-anchor="middle">1. Intent Classifier Node</text>
      <text x="125" y="44" fill="#a5b4fc" font-size="10" text-anchor="middle">Structured Pydantic Output Routing</text>
    </g>

    <!-- Node 2a: Hybrid Retrieval -->
    <g transform="translate(320, 50)">
      <rect width="260" height="60" rx="10" fill="#0f2942" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="130" y="26" fill="#bae6fd" font-size="12" font-weight="700" text-anchor="middle">2a. Hybrid Retrieval &amp; RRF Node</text>
      <text x="130" y="44" fill="#7dd3fc" font-size="10" text-anchor="middle">HNSW (Dense) + BM25 (Sparse) Fusion</text>
    </g>

    <!-- Node 2b: Cross Encoder -->
    <g transform="translate(615, 50)">
      <rect width="245" height="60" rx="10" fill="#0f2942" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="122" y="26" fill="#bae6fd" font-size="12" font-weight="700" text-anchor="middle">2b. Cross-Encoder Reranker</text>
      <text x="122" y="44" fill="#7dd3fc" font-size="10" text-anchor="middle">Filters Top-4 Chunks (Score &gt;= 0.65)</text>
    </g>

    <!-- Connectors -->
    <line x1="280" y1="80" x2="315" y2="80" stroke="#818cf8" stroke-width="1.5" marker-end="url(#arr3)"/>
    <line x1="580" y1="80" x2="610" y2="80" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#arr3)"/>

    <!-- Tool Calling Nodes -->
    <g transform="translate(30, 150)">
      <rect width="250" height="60" rx="10" fill="#1e293b" stroke="#34d399" stroke-width="1.5"/>
      <text x="125" y="26" fill="#a7f3d0" font-size="12" font-weight="700" text-anchor="middle">3. SaaS Operational Tools</text>
      <text x="125" y="44" fill="#cbd5e1" font-size="10" text-anchor="middle">Billing Lookup • Subscription Status</text>
    </g>

    <!-- HITL Breakpoint Node -->
    <g transform="translate(320, 150)">
      <rect width="260" height="60" rx="10" fill="#3a1118" stroke="#f43f5e" stroke-width="1.5"/>
      <text x="130" y="26" fill="#fecdd3" font-size="12" font-weight="700" text-anchor="middle">4. HITL Risk Gate (interrupt)</text>
      <text x="130" y="44" fill="#fda4af" font-size="10" text-anchor="middle">Pauses execution for Refund &gt; $100</text>
    </g>

    <!-- Supervisor Approval -->
    <g transform="translate(615, 150)">
      <rect width="245" height="60" rx="10" fill="#1e293b" stroke="#f43f5e" stroke-width="1.5"/>
      <text x="122" y="26" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">5. Supervisor Admin Panel</text>
      <text x="122" y="44" fill="#cbd5e1" font-size="10" text-anchor="middle">Command(resume=Approved)</text>
    </g>

    <line x1="580" y1="180" x2="610" y2="180" stroke="#f43f5e" stroke-width="1.5" marker-end="url(#arr3)"/>

    <!-- Grounded Generator Node -->
    <g transform="translate(30, 250)">
      <rect width="400" height="60" rx="10" fill="#1e1b4b" stroke="#c084fc" stroke-width="1.5"/>
      <text x="200" y="26" fill="#f3e8ff" font-size="12" font-weight="700" text-anchor="middle">6. Grounded Generator with Citations</text>
      <text x="200" y="44" fill="#d8b4fe" font-size="10" text-anchor="middle">Strict Document Grounding • [Doc X, Page Y] Citations</text>
    </g>

    <!-- Faithfulness Auditor -->
    <g transform="translate(460, 250)">
      <rect width="400" height="60" rx="10" fill="#1e293b" stroke="#34d399" stroke-width="1.5"/>
      <text x="200" y="26" fill="#a7f3d0" font-size="12" font-weight="700" text-anchor="middle">7. Faithfulness &amp; Groundedness Gate</text>
      <text x="200" y="44" fill="#cbd5e1" font-size="10" text-anchor="middle">Atomic Claim Extraction • Zero Hallucination Guarantee</text>
    </g>

    <line x1="430" y1="280" x2="455" y2="280" stroke="#c084fc" stroke-width="1.5" marker-end="url(#arr-purple3)"/>

    <!-- Telemetry & Stream Output -->
    <g transform="translate(30, 340)">
      <rect width="830" height="55" rx="10" fill="#0a0f1d" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="415" y="25" fill="#38bdf8" font-size="13" font-weight="700" text-anchor="middle">FastAPI SSE Event Stream (astream_events v2)</text>
      <text x="415" y="43" fill="#94a3b8" font-size="11" text-anchor="middle">event: status ("Searching docs...") • event: token ("Delta...") • event: citations • Zero JSON Schema Leakage</text>
    </g>
  </g>

  <!-- 4. Subgraph Box: Isolated Data Tier (Bottom) -->
  <g transform="translate(50, 700)">
    <rect width="1350" height="250" rx="14" fill="#08101e" stroke="#34d399" stroke-width="2"/>
    <rect x="0" y="0" width="1350" height="32" rx="8" fill="#34d399" fill-opacity="0.15"/>
    <text x="15" y="21" fill="#6ee7b7" font-size="12" font-weight="800">ISOLATED DATA TIER: MULTI-TENANT STORAGE ARCHITECTURE</text>

    <!-- Storage 1: PostgreSQL pgvector -->
    <g transform="translate(30, 50)">
      <rect width="410" height="170" rx="10" fill="#0f172a" stroke="#34d399" stroke-width="1.5"/>
      <text x="205" y="30" fill="#34d399" font-size="14" font-weight="800" text-anchor="middle">PostgreSQL 16 + pgvector</text>
      <text x="205" y="52" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">Layer 2: Row-Level Security (RLS)</text>
      <text x="205" y="70" fill="#94a3b8" font-size="10" text-anchor="middle">SET LOCAL app.current_tenant_id = :org_id</text>
      <line x1="20" y1="85" x2="390" y2="85" stroke="#1e293b" stroke-width="1"/>
      <text x="205" y="105" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">Layer 3: Partition-Filtered HNSW Index</text>
      <text x="205" y="125" fill="#94a3b8" font-size="10" text-anchor="middle">WHERE organization_id = :org_id</text>
      <text x="205" y="145" fill="#34d399" font-size="10" font-weight="700" text-anchor="middle">Guaranteed Zero Cross-Tenant Data Contamination</text>
    </g>

    <!-- Storage 2: PostgresSaver Checkpointer -->
    <g transform="translate(470, 50)">
      <rect width="410" height="170" rx="10" fill="#0f172a" stroke="#818cf8" stroke-width="1.5"/>
      <text x="205" y="30" fill="#818cf8" font-size="14" font-weight="800" text-anchor="middle">PostgresSaver Checkpointer</text>
      <text x="205" y="52" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">Durable StateGraph Persistence</text>
      <text x="205" y="70" fill="#94a3b8" font-size="10" text-anchor="middle">Thread Isolation: thread_id = org_{id}:user_{id}:conv_{id}</text>
      <line x1="20" y1="85" x2="390" y2="85" stroke="#1e293b" stroke-width="1"/>
      <text x="205" y="105" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">Durable HITL Resumption</text>
      <text x="205" y="125" fill="#94a3b8" font-size="10" text-anchor="middle">State persisted across 14-hour human supervisor delays</text>
      <text x="205" y="145" fill="#818cf8" font-size="10" font-weight="700" text-anchor="middle">Zero Server / Worker Process Memory Starvation</text>
    </g>

    <!-- Storage 3: Redis Engine -->
    <g transform="translate(910, 50)">
      <rect width="410" height="170" rx="10" fill="#0f172a" stroke="#fbbf24" stroke-width="1.5"/>
      <text x="205" y="30" fill="#fbbf24" font-size="14" font-weight="800" text-anchor="middle">Redis In-Memory Engine</text>
      <text x="205" y="52" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">Distributed Rate Limiting</text>
      <text x="205" y="70" fill="#94a3b8" font-size="10" text-anchor="middle">Sliding Window Leaky Bucket per organization</text>
      <line x1="20" y1="85" x2="390" y2="85" stroke="#1e293b" stroke-width="1"/>
      <text x="205" y="105" fill="#e2e8f0" font-size="11" font-weight="600" text-anchor="middle">Celery Message Broker &amp; Semantic Cache</text>
      <text x="205" y="125" fill="#94a3b8" font-size="10" text-anchor="middle">Asynchronous Ingestion Job Queue &amp; Lock Manager</text>
      <text x="205" y="145" fill="#fbbf24" font-size="10" font-weight="700" text-anchor="middle">Sub-millisecond Latency Key-Value Store</text>
    </g>
  </g>
</svg>`;
}

// ==============================================================================
// DIAGRAM 4: LangGraph Agentic State Machine Flowchart
// ==============================================================================
function generateDiagram4Svg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1400" height="920" viewBox="0 0 1400 920" xmlns="http://www.w3.org/2000/svg" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bgGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070a13"/>
      <stop offset="100%" stop-color="#0a0f1d"/>
    </linearGradient>
    <marker id="arr4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/>
    </marker>
    <marker id="arr-green4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#34d399"/>
    </marker>
    <marker id="arr-red4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e"/>
    </marker>
  </defs>

  <rect width="1400" height="920" rx="16" fill="url(#bgGrad4)" stroke="#1e293b" stroke-width="2"/>

  <!-- Title Banner -->
  <rect x="30" y="25" width="1340" height="65" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.3"/>
  <text x="50" y="54" fill="#38bdf8" font-size="19" font-weight="800">LANGGRAPH CYCLIC STATE MACHINE &amp; CONDITIONAL ROUTING</text>
  <text x="50" y="74" fill="#94a3b8" font-size="12">Dynamic intent routing, hybrid RAG retrieval, SaaS tool execution, and durable Human-in-the-Loop breakpoints</text>

  <!-- START Node -->
  <g transform="translate(620, 115)">
    <rect width="160" height="45" rx="22" fill="#2563eb" stroke="#38bdf8" stroke-width="2"/>
    <text x="80" y="28" fill="#ffffff" font-size="14" font-weight="800" text-anchor="middle">START</text>
  </g>
  <line x1="700" y1="160" x2="700" y2="195" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr4)"/>

  <!-- Node 1: Intent Classification -->
  <g transform="translate(560, 200)">
    <rect width="280" height="65" rx="12" fill="#1e1b4b" stroke="#818cf8" stroke-width="2"/>
    <text x="140" y="28" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="middle">1. Intent Classifier Node</text>
    <text x="140" y="48" fill="#c7d2fe" font-size="11" text-anchor="middle">Pydantic Structured Output Decision</text>
  </g>

  <!-- Conditional Edge Fan-out -->
  <line x1="700" y1="265" x2="700" y2="300" stroke="#818cf8" stroke-width="2"/>
  
  <!-- Horizontal Fan-out Bar -->
  <line x1="150" y1="300" x2="1250" y2="300" stroke="#818cf8" stroke-width="2"/>

  <!-- Vertical lines to 5 routes -->
  <line x1="150" y1="300" x2="150" y2="340" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr4)"/>
  <line x1="430" y1="300" x2="430" y2="340" stroke="#34d399" stroke-width="2" marker-end="url(#arr-green4)"/>
  <line x1="700" y1="300" x2="700" y2="340" stroke="#34d399" stroke-width="2" marker-end="url(#arr-green4)"/>
  <line x1="970" y1="300" x2="970" y2="340" stroke="#f43f5e" stroke-width="2" marker-end="url(#arr-red4)"/>
  <line x1="1250" y1="300" x2="1250" y2="340" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr4)"/>

  <!-- Route Labels -->
  <text x="150" y="325" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="middle">rag_knowledge</text>
  <text x="430" y="325" fill="#34d399" font-size="11" font-weight="700" text-anchor="middle">billing_action</text>
  <text x="700" y="325" fill="#34d399" font-size="11" font-weight="700" text-anchor="middle">account_action</text>
  <text x="970" y="325" fill="#f43f5e" font-size="11" font-weight="700" text-anchor="middle">ticket_creation</text>
  <text x="1250" y="325" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">general_chat</text>

  <!-- Route 1: RAG Knowledge -->
  <g transform="translate(40, 345)">
    <rect width="220" height="75" rx="10" fill="#0c1a2e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="110" y="28" fill="#e0f2fe" font-size="12" font-weight="700" text-anchor="middle">2a. Hybrid Retrieval &amp; RRF</text>
    <text x="110" y="46" fill="#7dd3fc" font-size="10" text-anchor="middle">Dense HNSW + Sparse BM25</text>
    <text x="110" y="62" fill="#94a3b8" font-size="10" text-anchor="middle">Top 20 Fused Candidates</text>
  </g>
  <line x1="150" y1="420" x2="150" y2="455" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr4)"/>

  <!-- RAG Stage 2: Cross Encoder -->
  <g transform="translate(40, 460)">
    <rect width="220" height="75" rx="10" fill="#0c1a2e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="110" y="28" fill="#e0f2fe" font-size="12" font-weight="700" text-anchor="middle">Cross-Encoder Reranker</text>
    <text x="110" y="46" fill="#7dd3fc" font-size="10" text-anchor="middle">ms-marco-MiniLM-L-6-v2</text>
    <text x="110" y="62" fill="#34d399" font-size="10" font-weight="600" text-anchor="middle">Threshold &gt;= 0.65 Confidence Gate</text>
  </g>
  <line x1="150" y1="535" x2="150" y2="570" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr4)"/>

  <!-- RAG Stage 3: Grounded Generator -->
  <g transform="translate(40, 575)">
    <rect width="220" height="75" rx="10" fill="#1e1b4b" stroke="#c084fc" stroke-width="1.5"/>
    <text x="110" y="28" fill="#f3e8ff" font-size="12" font-weight="700" text-anchor="middle">3. Grounded Generator</text>
    <text x="110" y="46" fill="#d8b4fe" font-size="10" text-anchor="middle">Strict Inline Citations [Doc X]</text>
    <text x="110" y="62" fill="#94a3b8" font-size="10" text-anchor="middle">Faithfulness Self-Check</text>
  </g>

  <!-- Route 2: Billing Tool -->
  <g transform="translate(325, 345)">
    <rect width="210" height="75" rx="10" fill="#064e3b" stroke="#34d399" stroke-width="1.5"/>
    <text x="105" y="28" fill="#d1fae5" font-size="12" font-weight="700" text-anchor="middle">2b. Billing Tool Node</text>
    <text x="105" y="46" fill="#6ee7b7" font-size="10" text-anchor="middle">Read-only Stripe / DB Query</text>
    <text x="105" y="62" fill="#cbd5e1" font-size="10" text-anchor="middle">Active Plan &amp; Period End</text>
  </g>

  <!-- Route 3: Account Tool -->
  <g transform="translate(595, 345)">
    <rect width="210" height="75" rx="10" fill="#064e3b" stroke="#34d399" stroke-width="1.5"/>
    <text x="105" y="28" fill="#d1fae5" font-size="12" font-weight="700" text-anchor="middle">2c. Account Tool Node</text>
    <text x="105" y="46" fill="#6ee7b7" font-size="10" text-anchor="middle">Team Seats &amp; Usage Stats</text>
    <text x="105" y="62" fill="#cbd5e1" font-size="10" text-anchor="middle">Strict Tenant Permission Check</text>
  </g>

  <!-- Route 4: Support Ticket & HITL -->
  <g transform="translate(865, 345)">
    <rect width="210" height="75" rx="10" fill="#3a1118" stroke="#f43f5e" stroke-width="1.5"/>
    <text x="105" y="28" fill="#ffe4e6" font-size="12" font-weight="700" text-anchor="middle">2d. Ticket Risk Check</text>
    <text x="105" y="46" fill="#fda4af" font-size="10" text-anchor="middle">Sensitive Words (refund, cancel)</text>
    <text x="105" y="62" fill="#cbd5e1" font-size="10" text-anchor="middle">If Non-Admin: Trigger HITL</text>
  </g>
  <line x1="970" y1="420" x2="970" y2="455" stroke="#f43f5e" stroke-width="2" marker-end="url(#arr-red4)"/>

  <!-- HITL Breakpoint Box -->
  <g transform="translate(865, 460)">
    <rect width="210" height="75" rx="10" fill="#4c0519" stroke="#f43f5e" stroke-width="2" stroke-dasharray="6,3"/>
    <text x="105" y="28" fill="#fecdd3" font-size="12" font-weight="800" text-anchor="middle">4. interrupt() Breakpoint</text>
    <text x="105" y="46" fill="#fda4af" font-size="10" text-anchor="middle">State Serialized to Postgres</text>
    <text x="105" y="62" fill="#fecaca" font-size="10" font-weight="600" text-anchor="middle">Waits for Supervisor Approval</text>
  </g>
  <line x1="970" y1="535" x2="970" y2="570" stroke="#34d399" stroke-width="2" marker-end="url(#arr-green4)"/>
  <text x="1055" y="555" fill="#34d399" font-size="10" font-weight="700">Command(resume=True)</text>

  <!-- Ticket Created Node -->
  <g transform="translate(865, 575)">
    <rect width="210" height="75" rx="10" fill="#064e3b" stroke="#34d399" stroke-width="1.5"/>
    <text x="105" y="28" fill="#d1fae5" font-size="12" font-weight="700" text-anchor="middle">Execute Ticket Creation</text>
    <text x="105" y="46" fill="#6ee7b7" font-size="10" text-anchor="middle">Internal Helpdesk / Jira API</text>
    <text x="105" y="62" fill="#cbd5e1" font-size="10" text-anchor="middle">Ticket # Generated</text>
  </g>

  <!-- Route 5: General Chat -->
  <g transform="translate(1145, 345)">
    <rect width="210" height="75" rx="10" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="105" y="28" fill="#f8fafc" font-size="12" font-weight="700" text-anchor="middle">2e. Conversational LLM</text>
    <text x="105" y="46" fill="#cbd5e1" font-size="10" text-anchor="middle">General SaaS Queries</text>
    <text x="105" y="62" fill="#94a3b8" font-size="10" text-anchor="middle">No Tool Calls Required</text>
  </g>

  <!-- Convergence to Final Response -->
  <!-- Horizontal Convergence Bar -->
  <line x1="150" y1="680" x2="1250" y2="680" stroke="#38bdf8" stroke-width="2"/>
  
  <line x1="150" y1="650" x2="150" y2="680" stroke="#38bdf8" stroke-width="2"/>
  <line x1="430" y1="420" x2="430" y2="680" stroke="#34d399" stroke-width="2"/>
  <line x1="700" y1="420" x2="700" y2="680" stroke="#34d399" stroke-width="2"/>
  <line x1="970" y1="650" x2="970" y2="680" stroke="#34d399" stroke-width="2"/>
  <line x1="1250" y1="420" x2="1250" y2="680" stroke="#94a3b8" stroke-width="2"/>

  <line x1="700" y1="680" x2="700" y2="715" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr4)"/>

  <!-- Final Response Node -->
  <g transform="translate(480, 720)">
    <rect width="440" height="60" rx="12" fill="#047857" stroke="#34d399" stroke-width="2"/>
    <text x="220" y="27" fill="#ffffff" font-size="14" font-weight="800" text-anchor="middle">5. Final Markdown Response &amp; SSE Stream</text>
    <text x="220" y="47" fill="#a7f3d0" font-size="11" text-anchor="middle">Tokens streamed in real-time • Structured source citations attached</text>
  </g>
  <line x1="700" y1="780" x2="700" y2="810" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr4)"/>

  <!-- Checkpoint & Audit Node -->
  <g transform="translate(510, 815)">
    <rect width="380" height="45" rx="10" fill="#0f172a" stroke="#818cf8" stroke-width="1.5"/>
    <text x="190" y="28" fill="#e2e8f0" font-size="12" font-weight="700" text-anchor="middle">6. Persist Audit Log &amp; PostgresSaver Checkpoint</text>
  </g>
  <line x1="700" y1="860" x2="700" y2="885" stroke="#38bdf8" stroke-width="2" marker-end="url(#arr4)"/>

  <!-- END Node -->
  <g transform="translate(630, 890)">
    <rect width="140" height="30" rx="15" fill="#2563eb" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="70" y="20" fill="#ffffff" font-size="12" font-weight="800" text-anchor="middle">END</text>
  </g>
</svg>`;
}

async function buildAllDiagrams() {
  console.log('[DIAGRAM GENERATOR] Generating high-resolution vector SVGs and PNGs...');

  const diagrams = [
    {
      name: '01-stripe-billing-lifecycle-architecture',
      svg: generateDiagram1Svg(),
      width: 1500,
      height: 1200
    },
    {
      name: '02-subscription-state-machine',
      svg: generateDiagram2Svg(),
      width: 1350,
      height: 750
    },
    {
      name: '03-multi-tenant-rag-system-topology',
      svg: generateDiagram3Svg(),
      width: 1450,
      height: 1000
    },
    {
      name: '04-langgraph-agentic-state-machine',
      svg: generateDiagram4Svg(),
      width: 1400,
      height: 920
    }
  ];

  for (const d of diagrams) {
    const svgPath = path.join(outputDir, `${d.name}.svg`);
    const pngPath = path.join(outputDir, `${d.name}.png`);

    // 1. Write SVG file
    fs.writeFileSync(svgPath, d.svg, 'utf-8');
    console.log(`[DIAGRAM GENERATOR] Saved SVG: ${svgPath}`);

    // 2. Convert SVG to high-res 2x PNG using sharp
    await sharp(Buffer.from(d.svg), { density: 200 })
      .png({ quality: 100, compressionLevel: 8 })
      .toFile(pngPath);
    console.log(`[DIAGRAM GENERATOR] Rendered high-res PNG: ${pngPath}`);
  }

  console.log('[DIAGRAM GENERATOR] All 4 diagrams successfully generated in high-resolution!');
}

buildAllDiagrams().catch(err => {
  console.error('[DIAGRAM GENERATOR] Error:', err);
  process.exit(1);
});
