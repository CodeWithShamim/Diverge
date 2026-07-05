import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { createClient, createAccount, generatePrivateKey } = await import(
  join(root, "app/node_modules/genlayer-js/dist/index.js")
);
const { studionet } = await import(
  join(root, "app/node_modules/genlayer-js/dist/chains/index.js")
);

const RPC = "https://studio.genlayer.com/api";
const GEN = 10n ** 18n;

// -- env / addresses ----------------------------------------------------------

function parseEnv(path) {
  const out = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}

const env = {
  ...parseEnv(join(root, ".env")),
  ...parseEnv(join(root, "app/.env.local")),
};
const ADDR = {
  registry: env.VITE_ADDR_REGISTRY,
  arbiter: env.VITE_ADDR_ARBITER,
};
if (!ADDR.registry || !ADDR.arbiter) {
  console.error("VITE_ADDR_* missing from app/.env.local — deploy first");
  process.exit(1);
}

// -- clients ------------------------------------------------------------------
// assert_claim / challenge / resolve are permissionless, so the seeder does not
// need the deployer key: without PRIVATE_KEY it runs on fresh faucet-funded keys.

const deployer = createAccount(env.PRIVATE_KEY || generatePrivateKey());
const challenger = createAccount(generatePrivateKey());

const asDeployer = createClient({
  chain: studionet,
  endpoint: RPC,
  account: deployer,
});
const asChallenger = createClient({
  chain: studionet,
  endpoint: RPC,
  account: challenger,
});

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json();
}

async function fund(address, gen) {
  const r = await rpc("sim_fundAccount", [address, Number(BigInt(gen) * GEN)]);
  if (r.error) throw new Error(`faucet: ${r.error.message}`);
  console.log(`  faucet -> ${address}: ${gen} GEN (${r.result})`);
}

// -- tx helper ------------------------------------------------------------------

function leaderError(receipt) {
  const lr = receipt?.consensus_data?.leader_receipt;
  const first = Array.isArray(lr) ? lr[0] : lr;
  return first?.execution_result === "ERROR"
    ? first?.genvm_result?.stderr || "leader ERROR"
    : null;
}

async function write(client, address, functionName, args, valueGen = 0) {
  const value = BigInt(Math.round(valueGen * 1e6)) * 10n ** 12n;
  const hash = await client.writeContract({
    address,
    functionName,
    args,
    value,
  });
  process.stdout.write(
    `  ${functionName}(${JSON.stringify(args[0]).slice(0, 40)}…) ${hash.slice(0, 18)}… `,
  );
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "FINALIZED",
    interval: 5000,
    retries: 120, // adjudication runs a real LLM — allow up to 10 min
  });
  const err = leaderError(receipt);
  if (err) throw new Error(`${functionName} failed on-chain:\n${err}`);
  console.log(`FINALIZED (${receipt.status_name ?? receipt.status})`);
  return receipt;
}

const read = (fn, args) =>
  asDeployer.readContract({ address: ADDR.registry, functionName: fn, args });

// -- simulated content ----------------------------------------------------------
// Evidence refs are inline text (non-URL): the registry pins them by content
// hash, and the arbiter re-reads them without any web fetch — fully deterministic.

const disputes = [
  {
    label: "#0 ASSERTED — open assertion",
    claim:
      "The Diverge protocol settles bonded factual disputes with an AI arbiter and returns both bonds when a dispute is unresolvable.",
    evidence:
      "Diverge PRD v1.0, §4: disputes are opened with a bonded assertion; FR-3.3 mandates that UNRESOLVED verdicts return both bonds in full with no protocol fee.",
    subQuestions: [
      "Does the protocol require a bond to open a dispute?",
      "Are both bonds returned when the verdict is UNRESOLVED?",
    ],
  },
  {
    label: "#1 CHALLENGED — bonded counter-claim",
    claim:
      "Satoshi Nakamoto's Bitcoin whitepaper was published in October 2008.",
    evidence:
      "The paper 'Bitcoin: A Peer-to-Peer Electronic Cash System' was circulated to the Cryptography Mailing List on 31 October 2008 (metzdowd.com archive).",
    counterClaim: "The Bitcoin whitepaper was published in January 2009.",
    counterEvidence:
      "Bitcoin's genesis block was mined on 3 January 2009, which is when the network and its documentation went live.",
    subQuestions: [
      "Was the whitepaper circulated before the genesis block was mined?",
      "Is the publication date of a paper the date it was first circulated?",
    ],
  },
  {
    label: "#2 RESOLVED — adjudicated by the arbiter",
    claim: "The Eiffel Tower is located in Paris, France.",
    evidence:
      "Municipal records: the Eiffel Tower stands on the Champ de Mars, 7th arrondissement, Paris, France. Completed in March 1889 for the Exposition Universelle; it has never been relocated.",
    counterClaim: "The Eiffel Tower is located in Lyon, France.",
    counterEvidence:
      "A satirical travel blog from 2020 jokingly reported the tower had been moved to Lyon for a festival.",
    subQuestions: [
      "Does the evidence place the Eiffel Tower on the Champ de Mars in Paris?",
      "Does either side present credible evidence that the tower was ever relocated?",
    ],
    resolve: true,
  },
];

// -- run --------------------------------------------------------------------------

console.log(`deployer   ${deployer.address}`);
console.log(`challenger ${challenger.address} (fresh key, this run only)`);

console.log("\n== funding accounts (studio faucet)");
await fund(deployer.address, 50);
await fund(challenger.address, 50);

const before = Number(await read("get_dispute_count", []));
console.log(`\n== seeding (registry currently has ${before} disputes)`);

for (const d of disputes) {
  console.log(`\n${d.label}`);
  const id = Number(await read("get_dispute_count", []));
  await write(
    asDeployer,
    ADDR.registry,
    "assert_claim",
    [d.claim, d.evidence, d.subQuestions],
    1,
  );
  if (d.counterClaim) {
    await write(
      asChallenger,
      ADDR.registry,
      "challenge",
      [id, d.counterClaim, d.counterEvidence],
      1,
    );
  }
  if (d.resolve) {
    console.log(
      "  adjudicating via Diverge arbiter (StudioNet LLM — may take minutes)…",
    );
    await write(asDeployer, ADDR.arbiter, "resolve", [id]);
  }
}

console.log("\n== final board state");
const count = Number(await read("get_dispute_count", []));
for (let i = before; i < count; i++) {
  const d = await read("get_dispute", [i]);
  console.log(
    `  #${i} ${d.status}${d.winner !== "NONE" ? ` winner=${d.winner}` : ""} — ${d.claim_a.slice(0, 60)}…`,
  );
}
console.log(`\nDone. ${count - before} disputes seeded (total ${count}).`);
